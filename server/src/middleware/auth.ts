import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../services/auth-service.js";

export type AuthenticatedRequest = Request & { userId?: string };

export function optionalAuth(auth: AuthService) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const token = req.cookies?.session;
    if (typeof token === "string") {
      const userId = auth.verifyToken(token);
      if (userId) req.userId = userId;
    }
    next();
  };
}

export function requireAuth(auth: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    optionalAuth(auth)(req, res, () => {
      if (!req.userId) return res.status(401).json({ error: "Please sign in to continue." });
      next();
    });
  };
}
