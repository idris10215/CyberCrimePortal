# National Cyber Crime Reporting Portal — Independent Hackathon Prototype

## Goal

Build a citizen-first prototype that helps a person prepare a financial cybercrime
report.

The citizen should be able to explain what happened naturally instead of manually
filling complicated government form fields.

## MVP

Only support UPI/financial fraud.

## Core journey

1. Citizen describes what happened.
2. AI extracts structured information.
3. Citizen verifies the extracted information.
4. System identifies missing information.
5. Citizen provides missing information.
6. Citizen uploads synthetic evidence.
7. AI extracts visible information from the evidence.
8. Citizen verifies extracted evidence information.
9. System generates a complaint draft.
10. Citizen reviews the complete report.
11. System performs a MOCK submission only.

## AI responsibilities

Use OpenAI for:
- Extracting structured information from the citizen's story.
- Extracting visible information from synthetic evidence images.
- Drafting the final incident description from verified information.

Do NOT use AI to:
- Determine guilt.
- Identify criminals.
- Investigate anyone.
- Give legal advice.
- Guarantee recovery of money.
- Contact police.
- Submit a real complaint.

## Safety

- Never connect to the real National Cyber Crime Reporting Portal.
- Never use real citizen information.
- Never use real bank/payment information.
- Use synthetic data only.
- Never invent missing information.
- Unknown information must remain unknown.
- AI-extracted information must be shown to the citizen for verification.
- Never claim that a real complaint was submitted.
- Never use government logos or imply government endorsement.
- API keys must remain server-side.

## UX

- Citizen-first.
- Mobile-first.
- English for MVP.
- Simple conversational language.
- Ask one question at a time.
- Avoid unnecessary government terminology.
- Always show the citizen what information has been collected.
- Allow the citizen to correct AI-extracted information.

## Required journey

Story
→ AI extraction
→ Verification
→ Missing information
→ Evidence upload
→ Evidence extraction
→ Verification
→ Report generation
→ Review
→ Mock submission
→ Confirmation

## Engineering

Keep the architecture simple.

Use deterministic application logic for:
- Required-field validation
- Missing-field detection
- Workflow/state management

Use OpenAI where AI provides meaningful value.

Include tests for:
- Information extraction
- Missing information
- Evidence extraction
- AI hallucination prevention
- Report generation
- Mock submission