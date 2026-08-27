import { extname, join, resolve } from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { contactSchema, incidentSchema, type ContactDetails, type Incident, type IncidentCase } from "../../../shared/incident-schema.js";
import { CaseRepository } from "../repositories/case-repository.js";
import { findMissingFields, nextMissingQuestion } from "../workflow/missing-fields.js";
import type { IncidentExtractor } from "./incident-extractor.js";

const emptyIncident = (): Incident => incidentSchema.parse({ fraudType: "upi_financial_fraud", incidentDate: null, incidentTime: null, amountLost: null, currency: "INR", paymentApp: null, transactionId: null, recipientUpiId: null, victimName: null, victimContact: null, phoneNumber: null, bankOrMerchant: null, narrativeFacts: [] });

export class CaseService {
  public constructor(private readonly repository: CaseRepository, private readonly incidentExtractor: IncidentExtractor) {}
  public async create(userId: string | null = null): Promise<IncidentCase> {
    const now = new Date().toISOString(); const incident = emptyIncident();
    return this.repository.create({ id: randomUUID(), status: "story", story: "", incident, verifiedFields: [], missingFields: findMissingFields(incident), evidence: [], contact: null, reportDraft: null, mockSubmission: null, userId, claimTokenHash: null, claimTokenExpiresAt: null, createdAt: now, updatedAt: now });
  }
  public async saveStory(id: string, story: string, userId: string | null = null) {
    if (!await this.authorizedCase(id, userId)) return null;
    const incident = await this.incidentExtractor.extract(story);
    return this.repository.update(id, (current) => ({ ...current, story, incident, verifiedFields: [], missingFields: findMissingFields(incident), status: "incident_verification", updatedAt: new Date().toISOString() }));
  }
  public async updateIncident(id: string, updates: Partial<Omit<Incident, "fraudType" | "currency">>, userId: string | null = null) {
    if (!await this.authorizedCase(id, userId)) return null;
    return this.repository.update(id, (current) => {
      const incident = incidentSchema.parse({ ...current.incident, ...updates }); const missingFields = findMissingFields(incident);
      return { ...current, incident, missingFields, verifiedFields: Array.from(new Set([...current.verifiedFields, ...Object.keys(updates)])), status: missingFields.length ? "missing_information" : "evidence", updatedAt: new Date().toISOString() };
    });
  }
  public async addEvidence(id: string, filename: string, mimeType: "image/png" | "image/jpeg" | "application/pdf", base64: string, userId: string | null = null) {
    if (!await this.authorizedCase(id, userId)) return null;
    const evidenceId = randomUUID(); const extension = extname(filename) || (mimeType === "application/pdf" ? ".pdf" : mimeType === "image/jpeg" ? ".jpg" : ".png");
    const uploadsDir = resolve("server/data/uploads"); const contents = Buffer.from(base64, "base64"); const storedPath = `/uploads/${evidenceId}${extension}`;
    await mkdir(uploadsDir, { recursive: true }); await writeFile(join(uploadsDir, `${evidenceId}${extension}`), contents);
    return this.repository.update(id, (current) => ({ ...current, evidence: [...current.evidence, { id: evidenceId, filename, mimeType, storedPath, size: contents.length }], updatedAt: new Date().toISOString() }));
  }
  public async removeEvidence(id: string, evidenceId: string, userId: string | null = null) {
    const current = await this.authorizedCase(id, userId); const evidence = current?.evidence.find((item) => item.id === evidenceId); if (!current || !evidence) return null;
    await unlink(join(resolve("server/data/uploads"), evidence.storedPath.replace("/uploads/", ""))).catch(() => undefined);
    return this.repository.update(id, (item) => ({ ...item, evidence: item.evidence.filter((entry) => entry.id !== evidenceId), updatedAt: new Date().toISOString() }));
  }
  public async saveContact(id: string, contact: ContactDetails, userId: string | null = null) {
    if (!await this.authorizedCase(id, userId)) return null;
    const parsed = contactSchema.parse(contact);
    return this.repository.update(id, (current) => ({ ...current, contact: parsed, status: "review", updatedAt: new Date().toISOString() }));
  }
  public async submitMock(id: string, userId: string | null = null) {
    const current = await this.authorizedCase(id, userId); if (!current) return null;
    const now = new Date().toISOString(); const reference = `NCRP-DEMO-${new Date().getUTCFullYear()}-${String((await this.repository.countSubmitted()) + 1).padStart(6, "0")}`;
    const claimToken = current.userId ? undefined : randomBytes(32).toString("hex");
    const updated = await this.repository.update(id, (item) => ({ ...item, status: "mock_submitted", mockSubmission: { submittedAt: now, reference, status: "Complaint Submitted" }, claimTokenHash: claimToken ? this.hashClaimToken(claimToken) : null, claimTokenExpiresAt: claimToken ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null, updatedAt: now }));
    return updated && claimToken ? { ...updated, claimToken } : updated;
  }
  public async getMissing(id: string, userId: string | null = null) { const item = await this.authorizedCase(id, userId); return item ? { missingFields: findMissingFields(item.incident), nextQuestion: nextMissingQuestion(item.incident) } : null; }
  public async getCase(id: string, userId: string | null = null) { return this.authorizedCase(id, userId); }
  public async track(reference: string) { return this.repository.findByReference(reference); }
  public async getCasesForUser(userId: string) { return this.repository.findByUserId(userId); }
  public async claimWithToken(userId: string, claimToken: string) {
    const claimTokenHash = this.hashClaimToken(claimToken); const item = await this.repository.findByClaimTokenHash(claimTokenHash);
    if (!item || item.userId || !item.claimTokenExpiresAt || Date.parse(item.claimTokenExpiresAt) < Date.now()) return null;
    return this.repository.update(item.id, (current) => ({ ...current, userId, claimTokenHash: null, claimTokenExpiresAt: null, updatedAt: new Date().toISOString() }));
  }

  private async authorizedCase(id: string, userId: string | null) {
    const item = await this.repository.findById(id);
    if (!item) return null;
    return item.userId && item.userId !== userId ? null : item;
  }

  private hashClaimToken(claimToken: string) {
    return createHash("sha256").update(claimToken).digest("hex");
  }
}
