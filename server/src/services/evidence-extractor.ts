import OpenAI from "openai";
import { z } from "zod";
import type { ServerEnvironment } from "../config/environment.js";

const evidenceExtractedSchema = z.object({
  visibleTransactionId: z.string().nullable(), visibleAmount: z.number().nullable(), visibleDateTime: z.string().nullable(),
  visibleRecipientUpiId: z.string().nullable(), visiblePaymentApp: z.string().nullable(), visibleText: z.array(z.string()),
});
export type ExtractedEvidence = z.infer<typeof evidenceExtractedSchema>;

export interface EvidenceExtractor {
  extract(filename: string, mimeType: string, base64: string): Promise<ExtractedEvidence>;
}

export class EvidenceExtractionError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "EvidenceExtractionError";
  }
}

const evidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "visibleTransactionId",
    "visibleAmount",
    "visibleDateTime",
    "visibleRecipientUpiId",
    "visiblePaymentApp",
    "visibleText",
  ],
  properties: {
    visibleTransactionId: { type: ["string", "null"] },
    visibleAmount: { type: ["number", "null"], exclusiveMinimum: 0 },
    visibleDateTime: { type: ["string", "null"] },
    visibleRecipientUpiId: { type: ["string", "null"] },
    visiblePaymentApp: { type: ["string", "null"] },
    visibleText: { type: "array", items: { type: "string" } },
  },
} as const;

const evidenceExtractionInstructions = `You extract structured information from a synthetic transaction receipt or screenshot image.
Return only the requested JSON object. Do not infer or invent values; if a field is not visible in the screenshot, return null. Extract visible transaction ID, amount, date/time, recipient UPI ID, and payment app name. In visibleText, provide a line-by-line list of all readable text in the image.`;

export class OpenAIEvidenceExtractor implements EvidenceExtractor {
  private readonly client: OpenAI;

  public constructor(private readonly environment: ServerEnvironment) {
    if (!environment.openAiApiKey) {
      throw new EvidenceExtractionError("OPENAI_API_KEY is required to extract evidence screenshots.");
    }
    this.client = new OpenAI({ apiKey: environment.openAiApiKey });
  }

  public async extract(filename: string, mimeType: string, base64: string): Promise<ExtractedEvidence> {
    try {
      const response = await this.client.responses.create({
        model: this.environment.openAiModel,
        store: false,
        instructions: evidenceExtractionInstructions,
        input: [
          { type: "text", text: `Analyze the receipt file "${filename}" and extract payment details.` },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ] as any, // Cast as any because the beta Responses SDK typings may vary depending on local version
        text: {
          format: {
            type: "json_schema",
            name: "evidence_extraction",
            strict: true,
            schema: evidenceJsonSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new EvidenceExtractionError("OpenAI returned no structured evidence output.");
      }

      return evidenceExtractedSchema.parse(JSON.parse(response.output_text));
    } catch (error) {
      if (error instanceof EvidenceExtractionError) throw error;
      throw new EvidenceExtractionError("OpenAI returned an invalid evidence extraction.", error);
    }
  }
}

export class MockEvidenceExtractor implements EvidenceExtractor {
  public async extract(filename: string, mimeType: string, base64: string): Promise<ExtractedEvidence> {
    // Generate high-quality realistic synthetic data based on the filename/type to simulate visual OCR.
    const isJPEG = mimeType === "image/jpeg";
    const extension = isJPEG ? "jpg" : "png";
    
    // We intentionally return synthetic details including an amount of 1500.00
    // so we can test the conflict UI if the citizen's incident report states a different amount.
    return {
      visibleTransactionId: "SYN888777666",
      visibleAmount: 1500,
      visibleDateTime: new Date().toISOString().replace("T", " ").substring(0, 16),
      visibleRecipientUpiId: "demo-receiver@upi",
      visiblePaymentApp: "DemoPay",
      visibleText: [
        "Transaction Successful",
        `File Reference: ${filename}`,
        "Paid to: demo-receiver@upi",
        "Amount: INR 1,500.00",
        "Txn ID: SYN888777666",
        "Type: UPI Payment",
        "Status: COMPLETED",
        `Format: ${extension.toUpperCase()} Image`
      ],
    };
  }
}
