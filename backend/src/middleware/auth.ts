import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { loadUser, readSession, signSession, type CurrentUser } from "../services/auth.service";
import type { Role } from "../utils/constants";
import { ApiError, forbidden, unauthorized } from "../utils/errors";

declare module "express-serve-static-core" {
  interface Request {
    user?: CurrentUser;
  }
}

/** Attach `req.user` when a valid session cookie is present. Never rejects. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = await readSession(req.cookies?.[env.sessionCookie]);
    if (userId) req.user = (await loadUser(userId)) ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a signed-in user, optionally with one of the given roles. */
export const requireAuth =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (roles.length && !roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Organizer with an active (not suspended) organizer profile. */
export function requireOrganizer(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  if (req.user.role !== "ORGANIZER") throw forbidden();
  if (!req.user.organizer) throw forbidden("Your account has no organizer profile.");
  if (req.user.organizer.status === "SUSPENDED") throw new ApiError(403, "This organizer account is suspended.", "SUSPENDED");
  next();
}

export async function startSession(res: Response, userId: string, role: Role) {
  const token = await signSession(userId, role);
  res.cookie(env.sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: env.sessionDays * 86_400_000,
  });
}

export function endSession(res: Response) {
  res.clearCookie(env.sessionCookie, { path: "/" });
}

/** The authenticated user, typed non-null (use after requireAuth). */
export const me = (req: Request): CurrentUser => req.user as CurrentUser;
/** The authenticated organizer's profile id (use after requireOrganizer). */
export const orgId = (req: Request): string => (req.user as CurrentUser).organizer!.id;
