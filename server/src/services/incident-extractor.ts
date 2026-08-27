import OpenAI from "openai";
import { incidentSchema, type Incident } from "../../../shared/incident-schema.js";
import type { ServerEnvironment } from "../config/environment.js";

export interface IncidentExtractor {
  extract(story: string): Promise<Incident>;
}

export class IncidentExtractionError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "IncidentExtractionError";
  }
}

const incidentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "fraudType",
    "incidentDate",
    "incidentTime",
    "amountLost",
    "currency",
    "paymentApp",
    "transactionId",
    "recipientUpiId",
    "victimName",
    "victimContact",
    "narrativeFacts",
  ],
  properties: {
    fraudType: { type: "string", enum: ["upi_financial_fraud"] },
    incidentDate: { type: ["string", "null"], description: "YYYY-MM-DD, or null" },
    incidentTime: { type: ["string", "null"], description: "24-hour HH:mm, or null" },
    amountLost: { type: ["number", "null"], exclusiveMinimum: 0 },
    currency: { type: "string", enum: ["INR"] },
    paymentApp: { type: ["string", "null"] },
    transactionId: { type: ["string", "null"] },
    recipientUpiId: { type: ["string", "null"] },
    victimName: { type: ["string", "null"] },
    victimContact: { type: ["string", "null"] },
    narrativeFacts: { type: "array", items: { type: "string" } },
  },
} as const;

const extractionInstructions = `You extract incident facts for a synthetic UPI financial-fraud reporting prototype.

Return only the requested JSON object. Extract a value only when the citizen explicitly states it. If a value is absent, unclear, implied, guessed, or derived, return null. Do not infer dates, times, amounts, payment apps, transaction IDs, UPI IDs, names, contacts, or any other value. Keep narrativeFacts as short, factual statements directly supported by the citizen's story; use an empty array when none are available.

Do not determine guilt, identify a criminal, investigate anyone, provide legal advice or conclusions, promise money recovery, contact anyone, or claim that a real report has been submitted.`;

function normalizedExplicitDate(story: string): string | null {
  const iso = story.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const numeric = story.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  const named = story.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
  const months: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  const parts = iso ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) } : numeric ? { year: Number(numeric[3]), month: Number(numeric[2]), day: Number(numeric[1]) } : named ? { year: Number(named[3]), month: months[named[2].toLowerCase()], day: Number(named[1]) } : null;
  if (!parts || !parts.month) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export class OpenAIIncidentExtractor implements IncidentExtractor {
  private readonly client: OpenAI;

  public constructor(private readonly environment: ServerEnvironment) {
    if (!environment.openAiApiKey) {
      throw new IncidentExtractionError("OPENAI_API_KEY is required to extract an incident story.");
    }
    this.client = new OpenAI({ apiKey: environment.openAiApiKey });
  }

  public async extract(story: string): Promise<Incident> {
    try {
      const response = await this.client.responses.create({
        model: this.environment.openAiModel,
        store: false,
        instructions: extractionInstructions,
        input: story,
        text: {
          format: {
            type: "json_schema",
            name: "incident_extraction",
            strict: true,
            schema: incidentJsonSchema,
          },
        },
      });

      if (!response.output_text) {
        throw new IncidentExtractionError("OpenAI returned no structured incident output.");
      }

      return incidentSchema.parse(JSON.parse(response.output_text));
    } catch (error) {
      if (error instanceof IncidentExtractionError) throw error;
      throw new IncidentExtractionError("OpenAI returned an invalid incident extraction.", error);
    }
  }
}

export class MockIncidentExtractor implements IncidentExtractor {
  public async extract(story: string): Promise<Incident> {
    const amountMatch = story.match(/(?:₹|rs\.?|rupees|inr)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:₹|rs\.?|rupees|inr)/i) ?? story.match(/(?:sent|send|paid|pay|transferred|transfer|lost)\s+(\d[\d,]*)/i);
    const appMatch = story.match(/\b(PhonePe|GPay|Google Pay|Paytm|BHIM|Amazon Pay|SyntheticPay|DemoPay)\b/i);
    const transactionMatch = story.match(/(?:transaction\s*(?:id|number)|txn\s*id|utr)\s*(?:is|was|:|#)?\s*([A-Za-z0-9-]{5,})/i);
    const upiMatch = story.match(/\b[a-z0-9._-]+@[a-z0-9.-]+\b/i);
    const timeMatch = story.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/) ?? story.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    const phoneMatch = story.match(/(?:phone|mobile|number)\s*(?:is|:)?\s*(\d{10})/i);
    const bankMatch = story.match(/\b(HDFC Bank|ICICI Bank|SBI|State Bank of India|Axis Bank|Kotak Bank|Bank of Baroda)\b/i);
    const incidentDate = normalizedExplicitDate(story);
    let incidentTime: string | null = null;
    if (timeMatch) {
      if (timeMatch[2] && /^\d{2}$/.test(timeMatch[2])) incidentTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      else { const hour = Number(timeMatch[1]) % 12 + (timeMatch[2].toLowerCase() === "pm" ? 12 : 0); incidentTime = `${String(hour).padStart(2, "0")}:00`; }
    }

    return incidentSchema.parse({
      fraudType: "upi_financial_fraud",
      incidentDate, incidentTime,
      amountLost: amountMatch ? Number((amountMatch[1] ?? amountMatch[2]).replace(/,/g, "")) : null,
      currency: "INR",
      paymentApp: appMatch?.[1] ?? null, transactionId: transactionMatch?.[1] ?? null, recipientUpiId: upiMatch?.[0] ?? null,
      victimName: null, victimContact: null, phoneNumber: phoneMatch?.[1] ?? null, bankOrMerchant: bankMatch?.[1] ?? null,
      narrativeFacts: [story.trim()],
    });
  }
}
