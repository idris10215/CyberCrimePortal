import { describe, expect, it } from "vitest";
import { incidentSchema } from "../../shared/incident-schema.js";
import { findMissingFields, nextMissingQuestion } from "../../server/src/workflow/missing-fields.js";

const baseIncident = {
  fraudType: "upi_financial_fraud" as const,
  incidentDate: null,
  incidentTime: null,
  amountLost: null,
  currency: "INR" as const,
  paymentApp: null,
  transactionId: null,
  recipientUpiId: null,
  victimName: null,
  victimContact: null,
  narrativeFacts: [],
};

describe("missing-field logic", () => {
  it("lists required UPI fields in citizen-friendly question order", () => {
    const incident = incidentSchema.parse(baseIncident);
    expect(findMissingFields(incident)).toEqual([
      "incidentDate",
      "amountLost",
      "paymentApp",
      "transactionId",
      "recipientUpiId",
    ]);
    expect(nextMissingQuestion(incident)).toEqual({
      field: "incidentDate",
      question: "On what date did this happen?",
    });
  });

  it("does not treat optional values as required", () => {
    const incident = incidentSchema.parse({
      ...baseIncident,
      incidentDate: "2026-08-26",
      amountLost: 1500,
      paymentApp: "SyntheticPay",
      transactionId: "SYNTHETIC123",
      recipientUpiId: "demo@upi",
    });
    expect(findMissingFields(incident)).toEqual([]);
    expect(nextMissingQuestion(incident)).toBeNull();
  });
});
