import { describe, expect, it } from "vitest";
import { MockEvidenceExtractor } from "../../server/src/services/evidence-extractor.js";

describe("MockEvidenceExtractor", () => {
  it("extracts synthetic facts and populates OCR text from mock receipt", async () => {
    const extractor = new MockEvidenceExtractor();
    const result = await extractor.extract("payment_receipt.png", "image/png", "base64data");

    expect(result).toMatchObject({
      visibleTransactionId: "SYN888777666",
      visibleAmount: 1500,
      visibleRecipientUpiId: "demo-receiver@upi",
      visiblePaymentApp: "DemoPay",
    });

    expect(result.visibleText).toContain("Transaction Successful");
    expect(result.visibleText).toContain("Amount: INR 1,500.00");
  });
});
