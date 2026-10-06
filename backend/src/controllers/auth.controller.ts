import type { Request, Response } from "express";
import { endSession, me, startSession } from "../middleware/auth";
import { body } from "../middleware/validate";
import * as auth from "../services/auth.service";
import type { Role } from "../utils/constants";
import { loginSchema, profileSchema, registerSchema } from "../validation/schemas";

export async function login(req: Request, res: Response) {
  const { email, password } = body(req, loginSchema);
  const user = await auth.login(email, password);
  await startSession(res, user.id, user.role as Role);
  res.json({ ok: true, role: user.role, home: auth.homeFor(user.role as Role) });
}

export async function register(req: Request, res: Response) {
  const input = body(req, registerSchema);
  const user = await auth.createAccount(input);
  await startSession(res, user.id, user.role as Role);
  res.json({ ok: true, role: user.role, home: auth.homeFor(user.role as Role) });
}

export function logout(_req: Request, res: Response) {
  endSession(res);
  res.json({ ok: true });
}

/** The signed-in user, or `{ user: null }` for visitors. Used by the frontend on every page render. */
export function current(req: Request, res: Response) {
  res.json({ user: req.user ?? null });
}

export async function updateMe(req: Request, res: Response) {
  const input = body(req, profileSchema);
  await auth.updateProfile(me(req).id, input);
  res.json({ ok: true });
}
