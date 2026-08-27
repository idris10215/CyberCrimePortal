# National Cyber Crime Reporting Portal (Prototype)

An independent, synthetic-data-only hackathon prototype for preparing a UPI/financial-fraud report. It does not connect to any government system and does not submit real complaints.

The active demonstration uses deterministic local logic only: no OpenAI, Gemini, government API, OCR, or real submission is used. Demo cases, uploaded PNG/JPEG/PDF evidence, suspect reports, and tracking references are stored locally under `server/data`.

## Run locally

```bash
npm install
npm run dev
```

The server starts at `http://localhost:3001`; the frontend shell starts at `http://localhost:5173`.

## Test and build

```bash
npm test
npm run build
```
