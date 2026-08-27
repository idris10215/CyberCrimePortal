import { describe, expect, it } from "vitest";
import { MockReportGenerator } from "../../server/src/services/report-generator.js";
import { incidentSchema, type IncidentCase } from "../../shared/incident-schema.js";

describe("MockReportGenerator", () => {
  it("only populates verified fields in the report draft and includes demonstration disclaimers", async () => {
    const generator = new MockReportGenerator();

    const caseData: IncidentCase = {
      id: "00000000-0000-0000-0000-000000000000",
      status: "evidence_verification",
      story: "I sent Rs 1200.",
      incident: incidentSchema.parse({
        fraudType: "upi_financial_fraud",
        incidentDate: "2026-08-20",
        incidentTime: "10:30",
        amountLost: 1200,
        currency: "INR",
        paymentApp: "DemoPay",
        transactionId: "TXN12345",
        recipientUpiId: "scammer@upi",
        victimName: "John Doe",
        victimContact: "9999988888",
        narrativeFacts: ["Citizen lost 1200 rupees."],
      }),
      // Only verify date, amount, and paymentApp
      verifiedFields: ["incidentDate", "amountLost", "paymentApp"],
      missingFields: ["transactionId", "recipientUpiId"],
      evidence: [],
      reportDraft: null,
      mockSubmission: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = await generator.generate(caseData);

    // Verify warnings
    expect(report).toContain("Draft for demonstration — not submitted to any authority.");

    // Verify verified fields
    expect(report).toContain("Date of Incident: 2026-08-20");
    expect(report).toContain("INR 1200");
    expect(report).toContain("Payment Application Used: DemoPay");

    // Verify unverified fields show up as unverified
    expect(report).toContain("Time of Incident: [Not Verified]");
    expect(report).toContain("Transaction Reference ID: [Not Verified]");
    expect(report).toContain("Recipient UPI Identifier: [Not Verified]");
  });
});
