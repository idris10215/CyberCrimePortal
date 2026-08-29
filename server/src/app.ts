import express from "express";
import cookieParser from "cookie-parser";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { z, ZodError } from "zod";
import { claimCaseSchema } from "../../shared/incident-schema.js";
import { loadServerEnvironment, type ServerEnvironment } from "./config/environment.js";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "./middleware/auth.js";
import { CaseRepository } from "./repositories/case-repository.js";
import { UserRepository } from "./repositories/user-repository.js";
import { createAuthRouter } from "./routes/auth.js";
import { createCaseRouter } from "./routes/cases.js";
import { AuthService } from "./services/auth-service.js";
import { CaseService } from "./services/case-service.js";
import { MockIncidentExtractor, OpenAIIncidentExtractor, type IncidentExtractor } from "./services/incident-extractor.js";

const demoIdentifiers = new Set(["demo-fraud@upi", "9999990000", "demo@fraud.test", "https://demo-fraud.example", "000111222333"]);

export function createApp(
  dataPath = resolve("server/data/cases.json"),
  incidentExtractor?: IncidentExtractor,
  environment: ServerEnvironment = loadServerEnvironment()
) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(resolve("server/data/uploads")));

  const extractor = incidentExtractor ?? (environment.useMockServices || !environment.openAiApiKey
    ? new MockIncidentExtractor()
    : new OpenAIIncidentExtractor(environment));

  const service = new CaseService(new CaseRepository(dataPath), extractor);
  const auth = new AuthService(new UserRepository(resolve(dirname(dataPath), "users.json")), environment.jwtSecret);

  app.use(optionalAuth(auth));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: environment.useMockServices ? "deterministic-local" : "openai-assisted" }));
  app.use("/api/auth", createAuthRouter(auth));
  app.get("/api/me/cases", requireAuth(auth), async (req: AuthenticatedRequest, res) => res.json(await service.getCasesForUser(req.userId!)));
  app.post("/api/me/cases/claim", requireAuth(auth), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { claimToken } = claimCaseSchema.parse(req.body);
      const item = await service.claimWithToken(req.userId!, claimToken);
      if (!item) return res.status(400).json({ error: "This complaint could not be attached to your account." });
      return res.json(item);
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/cases", createCaseRouter(service));
  app.get("/api/track/:reference", async (req, res) => {
    const item = await service.track(req.params.reference);
    if (!item?.mockSubmission) return res.status(404).json({ error: "Complaint reference not found in this demonstration system." });
    return res.json({ reference: item.mockSubmission.reference, submittedAt: item.mockSubmission.submittedAt, status: item.mockSubmission.status, caseId: item.id });
  });
  app.get("/api/suspects/check", (req, res) => {
    const identifier = String(req.query.identifier ?? "").trim().toLowerCase();
    res.json({ found: demoIdentifiers.has(identifier), label: demoIdentifiers.has(identifier) ? "Demo identifier found" : "No match in synthetic demonstration data" });
  });
  app.post("/api/suspects", async (req, res, next) => {
    try {
      const data = z.object({ type: z.string().min(1), identifier: z.string().min(1), description: z.string().min(1) }).parse(req.body);
      const entry = { reference: `SUSPECT-DEMO-${Math.floor(100000 + Math.random() * 900000)}`, ...data, createdAt: new Date().toISOString() };
      await mkdir(dirname(dataPath), { recursive: true });
      await appendFile(resolve(dirname(dataPath), "suspects.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  });

  const clientDist = resolve("client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        return next();
      }
      res.sendFile(resolve(clientDist, "index.html"));
    });
  }

  app.use((error: unknown, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    if (error instanceof ZodError) return res.status(400).json({ error: "Please check the information entered and try again." });
    return res.status(500).json({ error: "Unexpected server error" });
  });

  return app;
}

