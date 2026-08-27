import { Router, type NextFunction } from "express";
import { loginSchema, registerSchema } from "../../../shared/incident-schema.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AuthError, type AuthService } from "../services/auth-service.js";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: false, maxAge: 24 * 60 * 60 * 1000, path: "/" };

export function createAuthRouter(auth: AuthService) {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const result = await auth.register(body.name, body.email, body.password);
      res.cookie("session", result.token, cookieOptions).status(201).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await auth.login(body.email, body.password);
      res.cookie("session", result.token, cookieOptions).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie("session", { ...cookieOptions, maxAge: undefined }).json({ ok: true });
  });

  router.get("/me", requireAuth(auth), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.userId ? await auth.currentUser(req.userId) : null;
      if (!user) return res.status(401).json({ error: "Please sign in to continue." });
      return res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, next: NextFunction) => {
    if (error instanceof AuthError) return res.status(error.status).json({ error: error.message });
    return next(error);
  });

  return router;
}
