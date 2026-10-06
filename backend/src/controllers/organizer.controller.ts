import type { Request, Response } from "express";
import { me, orgId } from "../middleware/auth";
import { body } from "../middleware/validate";
import { getManagedEvent } from "../services/access.service";
import { organizerDashboard, organizerEvents, organizerPayouts } from "../services/analytics.service";
import { attendeesCsv, listAttendees, type AttendeeStatusFilter } from "../services/attendees.service";
import type { CurrentUser } from "../services/auth.service";
import { checkInByCode, checkInById, checkInProgress, undoCheckIn } from "../services/checkin.service";
import { db } from "../db/prisma";
import * as org from "../services/organizer.service";
import { cancelEventAndRefund } from "../services/orders.service";
import { publishEvent } from "../services/publishing.service";
import { ApiError } from "../utils/errors";
import {
  checkInSchema,
  eventBasicsSchema,
  manualCheckInSchema,
  messageSchema,
  organizerProfileSchema,
  refundDecisionSchema,
  sectionSchema,
  ticketTypeSchema,
} from "../validation/schemas";

type OrgUser = CurrentUser & { organizer: NonNullable<CurrentUser["organizer"]> };
const user = (req: Request) => me(req) as OrgUser;
const id = (req: Request) => String(req.params.id);

/* ------------------------------------------------------------------ dashboard */

export async function dashboard(req: Request, res: Response) {
  res.json(await organizerDashboard(orgId(req)));
}

export async function listEvents(req: Request, res: Response) {
  res.json({ events: await organizerEvents(orgId(req)) });
}

export async function createEvent(req: Request, res: Response) {
  const input = body(req, eventBasicsSchema);
  const event = await org.createDraft(orgId(req), input);
  res.json({ id: event.id });
}

export async function eventDetail(req: Request, res: Response) {
  res.json(await org.eventDetail(orgId(req), id(req)));
}

export async function eventOverview(req: Request, res: Response) {
  res.json(await org.eventOverview(orgId(req), id(req)));
}

export async function eventAnalytics(req: Request, res: Response) {
  res.json(await org.eventAnalyticsView(orgId(req), id(req)));
}

export async function updateEvent(req: Request, res: Response) {
  const input = body(req, sectionSchema);
  await org.updateEventSection(user(req), id(req), input);
  res.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function deleteEvent(req: Request, res: Response) {
  await org.deleteDraft(user(req), id(req));
  res.json({ ok: true });
}

export async function publish(req: Request, res: Response) {
  await getManagedEvent(user(req), id(req));
  const event = await publishEvent(id(req));
  res.json({ ok: true, status: event.status, slug: event.slug });
}

export async function unpublish(req: Request, res: Response) {
  await org.unpublish(user(req), id(req));
  res.json({ ok: true });
}

/** Cancel an event: every buyer is refunded in full and the event page shows it as cancelled. */
export async function cancel(req: Request, res: Response) {
  const event = await getManagedEvent(user(req), id(req));
  if (event.status === "CANCELLED") throw new ApiError(409, "This event is already cancelled.");
  if (event.status === "DRAFT") throw new ApiError(409, "Drafts can simply be deleted.");
  res.json({ ok: true, ...(await cancelEventAndRefund(event.id)) });
}

/* --------------------------------------------------------------- ticket types */

export async function addTicket(req: Request, res: Response) {
  const type = await org.addTicketType(user(req), id(req), body(req, ticketTypeSchema));
  res.json({ id: type.id });
}

export async function updateTicket(req: Request, res: Response) {
  await org.updateTicketType(user(req), id(req), String(req.params.typeId), body(req, ticketTypeSchema));
  res.json({ ok: true });
}

export async function deleteTicket(req: Request, res: Response) {
  await org.deleteTicketType(user(req), id(req), String(req.params.typeId));
  res.json({ ok: true });
}

/* ------------------------------------------------------------------ attendees */

export async function attendees(req: Request, res: Response) {
  await getManagedEvent(user(req), id(req));
  const q = req.query;
  const status = String(q.status ?? "all") as AttendeeStatusFilter;
  const [list, progress, types] = await Promise.all([
    listAttendees({
      eventId: id(req),
      q: typeof q.q === "string" ? q.q : undefined,
      status: ["all", "in", "not"].includes(status) ? status : "all",
      typeId: typeof q.type === "string" && q.type ? q.type : undefined,
      page: Number(q.page ?? 1) || 1,
    }),
    checkInProgress(id(req)),
    db.ticketType.findMany({ where: { eventId: id(req) }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  res.json({ ...list, progress, types });
}

export async function exportAttendees(req: Request, res: Response) {
  const event = await getManagedEvent(user(req), id(req));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${event.slug}-attendees.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(await attendeesCsv(event.id));
}

export async function message(req: Request, res: Response) {
  const { subject, body: text } = body(req, messageSchema);
  res.json({ ok: true, recipients: await org.messageAttendees(user(req), id(req), subject, text) });
}

/* -------------------------------------------------------------------- check-in */

export async function progress(req: Request, res: Response) {
  const event = await getManagedEvent(user(req), id(req));
  res.json({ title: event.title, progress: await checkInProgress(event.id) });
}

/** Door scanner: validate a scanned or typed ticket code and check it in. */
export async function checkIn(req: Request, res: Response) {
  await getManagedEvent(user(req), id(req));
  const { code, gate } = body(req, checkInSchema);
  const result = await checkInByCode(id(req), code, me(req).id, gate);
  res.json({ result, progress: await checkInProgress(id(req)) });
}

/** Manual check-in from the attendee list. */
export async function checkInTicket(req: Request, res: Response) {
  await getManagedEvent(user(req), id(req));
  const { gate } = body(req, manualCheckInSchema);
  const result = await checkInById(id(req), String(req.params.ticketId), me(req).id, gate || "Front desk");
  res.json({ result, progress: await checkInProgress(id(req)) });
}

export async function undoCheckInTicket(req: Request, res: Response) {
  await getManagedEvent(user(req), id(req));
  const undone = await undoCheckIn(id(req), String(req.params.ticketId));
  res.json({ undone, progress: await checkInProgress(id(req)) });
}

/* ------------------------------------------------------ orders, refunds, payouts */

export async function orders(req: Request, res: Response) {
  res.json(await org.ordersPage(orgId(req), Math.max(1, Number(req.query.page) || 1)));
}

export async function decideRefund(req: Request, res: Response) {
  const { decision } = body(req, refundDecisionSchema);
  await org.decideRefund(orgId(req), String(req.params.id), decision);
  res.json({ ok: true });
}

export async function payouts(req: Request, res: Response) {
  const [rows, profile] = await Promise.all([organizerPayouts(orgId(req)), org.getProfile(orgId(req))]);
  res.json({ rows, profile });
}

export async function getProfile(req: Request, res: Response) {
  res.json({ profile: await org.getProfile(orgId(req)) });
}

export async function updateProfile(req: Request, res: Response) {
  const input = body(req, organizerProfileSchema);
  res.json({ ok: true, ...(await org.updateProfile(orgId(req), input)) });
}
