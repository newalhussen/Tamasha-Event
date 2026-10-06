import type { Request, Response } from "express";
import { me } from "../middleware/auth";
import { body } from "../middleware/validate";
import * as events from "../services/events.service";
import { sanitizeSource } from "../services/orders.service";
import { notFound } from "../utils/errors";
import { reportSchema, viewSchema, waitlistSchema } from "../validation/schemas";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Public discovery: search, filters, featured and "going fast". */
export async function discover(req: Request, res: Response) {
  const q = req.query;
  const data = await events.discoverEvents({
    q: str(q.q)?.slice(0, 80),
    when: str(q.when) as events.When | undefined,
    from: str(q.from),
    to: str(q.to),
    cat: str(q.cat),
    price: str(q.price) as events.PriceFilter | undefined,
    sort: str(q.sort) as events.SortKey | undefined,
    limit: Math.min(Math.max(Number(q.limit) || 8, 8), 60),
  });
  res.json(data);
}

export async function detail(req: Request, res: Response) {
  const u = req.user;
  const page = await events.publicEventPage(String(req.params.slug), u ? { id: u.id, role: u.role, organizerId: u.organizer?.id } : undefined);
  if (!page) throw notFound("That event");
  res.json(page);
}

export async function calendar(req: Request, res: Response) {
  const { ics, filename } = await events.calendarFile(String(req.params.id));
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(ics);
}

/** Page-view beacon used by organizer analytics. */
export async function view(req: Request, res: Response) {
  const { source } = body(req, viewSchema);
  await events.recordView(String(req.params.id), sanitizeSource(source));
  res.json({ ok: true });
}

export async function save(req: Request, res: Response) {
  await events.setSaved(me(req).id, String(req.params.id), true);
  res.json({ saved: true });
}

export async function unsave(req: Request, res: Response) {
  await events.setSaved(me(req).id, String(req.params.id), false);
  res.json({ saved: false });
}

export async function waitlist(req: Request, res: Response) {
  const { phone } = body(req, waitlistSchema);
  res.json({ ok: true, ...(await events.joinWaitlist(String(req.params.id), phone)) });
}

export async function report(req: Request, res: Response) {
  const input = body(req, reportSchema);
  await events.reportEvent(String(req.params.id), req.user?.id, input.reason, input.details);
  res.json({ ok: true });
}
