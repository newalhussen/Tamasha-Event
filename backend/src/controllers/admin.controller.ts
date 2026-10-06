import type { Request, Response } from "express";
import { me } from "../middleware/auth";
import { body } from "../middleware/validate";
import * as admin from "../services/admin-console.service";
import { moderateEvent } from "../services/moderation.service";
import { moderationSchema, organizerActionSchema, reportStatusSchema, userStatusSchema } from "../validation/schemas";

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const page = (v: unknown) => Math.max(1, Number(v) || 1);

export async function counts(_req: Request, res: Response) {
  res.json(await admin.adminCounts());
}

export async function overview(req: Request, res: Response) {
  res.json(await admin.overview(typeof req.query.e === "string" ? req.query.e : undefined));
}

export async function events(req: Request, res: Response) {
  res.json(await admin.eventsList(str(req.query.q), str(req.query.s, "all"), page(req.query.page)));
}

export async function organizers(req: Request, res: Response) {
  res.json({ organizers: await admin.organizersList(str(req.query.s, "all")) });
}

export async function users(req: Request, res: Response) {
  res.json(await admin.usersList(str(req.query.q), str(req.query.role, "all"), page(req.query.page)));
}

export async function reports(req: Request, res: Response) {
  res.json({ reports: await admin.reportsList(str(req.query.s, "OPEN")) });
}

export async function moderate(req: Request, res: Response) {
  const { action, note } = body(req, moderationSchema);
  await moderateEvent({ eventId: String(req.params.id), adminId: me(req).id, action, note });
  res.json({ ok: true });
}

export async function organizerAction(req: Request, res: Response) {
  const { action, note } = body(req, organizerActionSchema);
  await admin.organizerAction(me(req).id, String(req.params.id), action, note);
  res.json({ ok: true });
}

export async function userStatus(req: Request, res: Response) {
  const { status } = body(req, userStatusSchema);
  await admin.setUserStatus(me(req).id, String(req.params.id), status);
  res.json({ ok: true });
}

export async function reportStatus(req: Request, res: Response) {
  const { status } = body(req, reportStatusSchema);
  await admin.setReportStatus(me(req).id, String(req.params.id), status);
  res.json({ ok: true });
}
