import { Router } from "express";
import { z, ZodError } from "zod";

import {
  contactSchema,
  createCaseSchema,
  incidentUpdateSchema,
  storySchema,
} from "../../../shared/incident-schema.js";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import { CaseService } from "../services/case-service.js";

const evidenceUploadSchema = z.object({
  filename: z.string().trim().min(1),
  mimeType: z.enum([
    "image/png",
    "image/jpeg",
    "application/pdf",
  ]),
  base64: z.string().trim().min(1),
});

export function createCaseRouter(service: CaseService) {
  const router = Router();

  /*
   * Express can infer route parameters as string | string[].
   * These helpers normalize them to plain strings for our service layer.
   */
  const getCaseId = (req: AuthenticatedRequest): string =>
    String(req.params.id);

  const getEvidenceId = (req: AuthenticatedRequest): string =>
    String(req.params.evidenceId);

  /*
   * Create a new complaint.
   *
   * If the citizen is logged in, the complaint is associated
   * with their account. Otherwise it remains a guest complaint.
   */
  router.post(
    "/",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        createCaseSchema.parse(req.body ?? {});

        const caseData = await service.create(
          req.userId ?? null,
        );

        return res.status(201).json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Save the citizen's story.
   */
  router.post(
    "/:id/story",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { story } = storySchema.parse(req.body);

        const caseData = await service.saveStory(
          getCaseId(req),
          story,
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Update / verify incident information.
   */
  router.patch(
    "/:id/incident",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const updates = incidentUpdateSchema.parse(req.body);

        const caseData = await service.updateIncident(
          getCaseId(req),
          updates,
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Get fields that are still missing.
   */
  router.get(
    "/:id/missing",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const missing = await service.getMissing(
          getCaseId(req),
          req.userId ?? null,
        );

        if (!missing) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(missing);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Upload evidence.
   *
   * This prototype accepts:
   * - PNG
   * - JPEG
   * - PDF
   *
   * The actual processing remains local/non-AI.
   */
  router.post(
    "/:id/evidence",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const item = evidenceUploadSchema.parse(req.body);

        const caseData = await service.addEvidence(
          getCaseId(req),
          item.filename,
          item.mimeType,
          item.base64,
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Delete evidence from a complaint.
   */
  router.delete(
    "/:id/evidence/:evidenceId",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const caseData = await service.removeEvidence(
          getCaseId(req),
          getEvidenceId(req),
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Save citizen contact information.
   */
  router.patch(
    "/:id/contact",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const contact = contactSchema.parse(req.body);

        const caseData = await service.saveContact(
          getCaseId(req),
          contact,
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Mock complaint submission.
   *
   * This does NOT submit anything to a real authority.
   */
  router.post(
    "/:id/mock-submit",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const caseData = await service.submitMock(
          getCaseId(req),
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Get one complaint.
   */
  router.get(
    "/:id",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const caseData = await service.getCase(
          getCaseId(req),
          req.userId ?? null,
        );

        if (!caseData) {
          return res.status(404).json({
            error: "Case not found",
          });
        }

        return res.json(caseData);
      } catch (error) {
        return next(error);
      }
    },
  );

  /*
   * Route-level error handler.
   */
  router.use(
    (
      error: unknown,
      _req: unknown,
      res: {
        status: (code: number) => {
          json: (body: unknown) => unknown;
        };
      },
      _next: unknown,
    ) => {
      if (error instanceof ZodError) {
        console.error(
          "Request validation failed:",
          error.flatten(),
        );

        return res.status(400).json({
          error:
            "Please check the information entered and try again.",
        });
      }

      console.error("Case route error:", error);

      return res.status(500).json({
        error: "Unexpected server error",
      });
    },
  );

  return router;
}