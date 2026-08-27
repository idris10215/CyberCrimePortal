import { describe, expect, it } from "vitest";
import { MockIncidentExtractor } from "../../server/src/services/incident-extractor.js";

describe("deterministic incident extractor", () => {
  it("extracts only explicitly stated information", async () => {
    const result = await new MockIncidentExtractor().extract("I transferred 25000 through UPI to demo-fraud@upi on 26 August 2026. Transaction ID is DEMO12345.");
    expect(result).toMatchObject({ amountLost: 25000, incidentDate: "2026-08-26", recipientUpiId: "demo-fraud@upi", transactionId: "DEMO12345" });
    expect(result.paymentApp).toBeNull();
    expect(result.incidentTime).toBeNull();
  });
  it("extracts the explicit citizen story values used in the complaint journey", async () => {
    const result = await new MockIncidentExtractor().extract("Someone called pretending to be from my bank and said my KYC was expiring. They asked me to transfer ₹25,000 through UPI using PhonePe. I transferred the money to demo-fraud@upi on 26 August 2026. The transaction ID was TXN123456789.");
    expect(result).toMatchObject({
      amountLost: 25000,
      paymentApp: "PhonePe",
      recipientUpiId: "demo-fraud@upi",
      incidentDate: "2026-08-26",
      transactionId: "TXN123456789",
    });
  });
  it("does not invent facts when they were not stated", async () => {
    const result = await new MockIncidentExtractor().extract("Someone contacted me.");
    expect(result.amountLost).toBeNull(); expect(result.recipientUpiId).toBeNull(); expect(result.transactionId).toBeNull();
  });
  it.each([
    ["26 August 2026", "2026-08-26"],
    ["26 Aug 2026", "2026-08-26"],
    ["26/08/2026", "2026-08-26"],
    ["2026-08-26", "2026-08-26"],
  ])("normalizes the explicit date format %s", async (input, expected) => {
    const result = await new MockIncidentExtractor().extract(`I sent ₹500 on ${input}.`);
    expect(result.incidentDate).toBe(expected);
  });
  it("leaves the date null when no explicit valid date is stated", async () => {
    const result = await new MockIncidentExtractor().extract("I sent ₹500 yesterday.");
    expect(result.incidentDate).toBeNull();
  });
});
