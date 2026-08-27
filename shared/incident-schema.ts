import { z } from "zod";

export const incidentStatuses = ["story", "incident_verification", "missing_information", "evidence", "contact", "review", "mock_submitted", "evidence_verification", "report_review"] as const;
export const incidentFields = ["incidentDate", "amountLost", "paymentApp", "transactionId", "recipientUpiId"] as const;

export const incidentSchema = z.object({
  fraudType: z.literal("upi_financial_fraud"), incidentDate: z.string().date().nullable(),
  incidentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), amountLost: z.number().positive().nullable(),
  currency: z.literal("INR"), paymentApp: z.string().trim().min(1).nullable(), transactionId: z.string().trim().min(1).nullable(),
  recipientUpiId: z.string().trim().min(1).nullable(), victimName: z.string().trim().min(1).nullable(), victimContact: z.string().trim().min(1).nullable(),
  phoneNumber: z.string().trim().min(1).nullable().default(null), bankOrMerchant: z.string().trim().min(1).nullable().default(null), narrativeFacts: z.array(z.string().trim().min(1)),
});
export const incidentUpdateSchema = incidentSchema.omit({ fraudType: true, currency: true }).partial().strict();
export const contactSchema = z.object({ fullName: z.string().trim().min(1), mobileNumber: z.string().trim().regex(/^\d{10}$/), email: z.string().trim().email().nullable(), otpVerified: z.boolean() });
export const evidenceSchema = z.object({ id: z.string(), filename: z.string(), mimeType: z.enum(["image/png", "image/jpeg", "application/pdf"]), storedPath: z.string(), size: z.number().nonnegative().default(0) });
export const mockSubmissionSchema = z.object({ submittedAt: z.string().datetime(), reference: z.string(), status: z.literal("Complaint Submitted").default("Complaint Submitted") });
export const incidentCaseSchema = z.object({
  id: z.string().uuid(), status: z.enum(incidentStatuses), story: z.string(), incident: incidentSchema, verifiedFields: z.array(z.string()),
  missingFields: z.array(z.enum(incidentFields)), evidence: z.array(evidenceSchema), contact: contactSchema.nullable().default(null), reportDraft: z.string().nullable(),
  mockSubmission: mockSubmissionSchema.nullable(), userId: z.string().uuid().nullable().default(null), claimTokenHash: z.string().nullable().default(null), claimTokenExpiresAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const createCaseSchema = z.object({}).strict();
export const storySchema = z.object({ story: z.string().trim().min(1).max(5000) });
export const userSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1), email: z.string().trim().email(), passwordHash: z.string().min(1), createdAt: z.string().datetime() });
export const safeUserSchema = userSchema.omit({ passwordHash: true });
export const registerSchema = z.object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string().min(8) });
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export const claimCaseSchema = z.object({ claimToken: z.string().trim().min(32) });
export type IncidentCase = z.infer<typeof incidentCaseSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type IncidentField = (typeof incidentFields)[number];
export type ContactDetails = z.infer<typeof contactSchema>;
export type User = z.infer<typeof userSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
