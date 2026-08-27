import OpenAI from "openai";
import { z } from "zod";
import { type IncidentCase } from "../../../shared/incident-schema.js";
import type { ServerEnvironment } from "../config/environment.js";

export interface ReportGenerator {
  generate(caseData: IncidentCase): Promise<string>;
}

export class ReportGenerationError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ReportGenerationError";
  }
}

const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reportDraft"],
  properties: {
    reportDraft: { type: "string" },
  },
} as const;

const reportGenerationInstructions = `You generate a structured, professional cybercrime report draft based strictly on the provided VERIFIED information.
Do not assume or invent any details. Clearly prefix and suffix the report with the text: "***Draft for demonstration — not submitted to any authority.***" Do not call it an official complaint. Maintain a completely objective tone, avoid legal advice, and do not make judgments about guilt. Output only the requested JSON containing reportDraft.`;

export class OpenAIReportGenerator implements ReportGenerator {
  private readonly client: OpenAI;

  public constructor(private readonly environment: ServerEnvironment) {
    if (!environment.openAiApiKey) {
      throw new ReportGenerationError("OPENAI_API_KEY is required to generate reports.");
    }
    this.client = new OpenAI({ apiKey: environment.openAiApiKey });
  }

  public async generate(caseData: IncidentCase): Promise<string> {
    try {
      const verified = new Set(caseData.verifiedFields);
      const incident = caseData.incident;

      const factSummary = {
        victimName: verified.has("victimName") ? incident.victimName : null,
        victimContact: verified.has("victimContact") ? incident.victimContact : null,
        incidentDate: verified.has("incidentDate") ? incident.incidentDate : null,
        incidentTime: verified.has("incidentTime") ? incident.incidentTime : null,
        amountLost: verified.has("amountLost") ? incident.amountLost : null,
        currency: incident.currency,
        paymentApp: verified.has("paymentApp") ? incident.paymentApp : null,
        transactionId: verified.has("transactionId") ? incident.transactionId : null,
        recipientUpiId: verified.has("recipientUpiId") ? incident.recipientUpiId : null,
        narrativeFacts: incident.narrativeFacts,
        evidence: caseData.evidence.map((ev) => ({ filename: ev.filename, mimeType: ev.mimeType, size: ev.size })),
      };

      const response = await this.client.responses.create({
        model: this.environment.openAiModel,
        store: false,
        instructions: reportGenerationInstructions,
        input: `Generate report draft for this case: ${JSON.stringify(factSummary)}`,
        text: {
          format: {
            type: "json_schema",
            name: "report_generation",
            strict: true,
            schema: reportJsonSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new ReportGenerationError("OpenAI returned no structured report output.");
      }

      const parsed = z.object({ reportDraft: z.string() }).parse(JSON.parse(response.output_text));
      return parsed.reportDraft;
    } catch (error) {
      if (error instanceof ReportGenerationError) throw error;
      throw new ReportGenerationError("OpenAI returned an invalid report generation.", error);
    }
  }
}

export class MockReportGenerator implements ReportGenerator {
  public async generate(caseData: IncidentCase): Promise<string> {
    const incident = caseData.incident;
    const verified = new Set(caseData.verifiedFields);

    const getField = (field: keyof typeof incident, label: string) => {
      if (!verified.has(field as string)) return `${label}: [Not Verified]`;
      const val = incident[field];
      return `${label}: ${val !== null && val !== undefined ? val : "[Not Provided]"}`;
    };

    const evidenceSection = caseData.evidence.length === 0
      ? "No supporting evidence files uploaded."
      : caseData.evidence.map((ev, index) => {
          return `Evidence File #${index + 1}: ${ev.filename} (${ev.mimeType})\n  - Uploaded locally; no OCR or extraction is performed in this prototype.`;
        }).join("\n\n");

    const narrativeSection = incident.narrativeFacts.length === 0
      ? "No specific timeline narrative facts verified."
      : incident.narrativeFacts.map((fact) => `- ${fact}`).join("\n");

    return `***Draft for demonstration — not submitted to any authority.***

# INCIDENT SUMMARY REPORT (DEMO)

This document is a synthetic draft containing only information that has been verified by the citizen. This is an independent hackathon prototype and has NOT been submitted to any law enforcement, government department, or payment authority.

## 1. Victim Identification
- ${getField("victimName", "Citizen Name (Synthetic)")}
- ${getField("victimContact", "Contact Details (Synthetic)")}

## 2. UPI Financial Incident Details
- ${getField("incidentDate", "Date of Incident")}
- ${getField("incidentTime", "Time of Incident")}
- Amount Lost: ${verified.has("amountLost") && incident.amountLost !== null ? `INR ${incident.amountLost}` : "[Not Verified]"}
- Currency: INR
- ${getField("paymentApp", "Payment Application Used")}
- ${getField("transactionId", "Transaction Reference ID")}
- ${getField("recipientUpiId", "Recipient UPI Identifier")}

## 3. Narrative Timeline of Events
${narrativeSection}

## 4. Attached Screenshots & Evidence
${evidenceSection}

***Draft for demonstration — not submitted to any authority.***`;
  }
}
