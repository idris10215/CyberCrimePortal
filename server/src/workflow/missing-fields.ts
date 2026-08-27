import {
  incidentFields,
  type Incident,
  type IncidentField,
} from "../../../shared/incident-schema.js";

export const missingFieldQuestions: Record<IncidentField, string> = {
  incidentDate: "On what date did this happen?",
  amountLost: "How much money was lost?",
  paymentApp: "Which payment app did you use?",
  transactionId: "What is the transaction ID?",
  recipientUpiId: "What was the recipient's UPI ID?",
};

export function findMissingFields(incident: Incident): IncidentField[] {
  return incidentFields.filter((field) => incident[field] === null);
}

export function nextMissingQuestion(incident: Incident) {
  const field = findMissingFields(incident)[0] ?? null;
  return field ? { field, question: missingFieldQuestions[field] } : null;
}
