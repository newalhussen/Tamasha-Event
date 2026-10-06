import "server-only";
import type { Event, Organizer, TicketType } from "@prisma/client";
import { db } from "./db";
import { ApiError } from "./api";

export type ChecklistItem = { key: string; label: string; done: boolean; hint?: string };

type EventForCheck = Event & { ticketTypes: TicketType[]; organizer: Organizer };

/** What an organizer still needs to do before an event can be published. */
export function publishChecklist(e: EventForCheck): ChecklistItem[] {
  const hasPaid = e.ticketTypes.some((t) => t.kind !== "FREE" && t.price > 0);
  return [
    {
      key: "basics",
      label: "Name, date and venue",
      done: e.title.trim().length >= 3 && !!e.venueName.trim() && e.capacity > 0,
      hint: "Add a venue and capacity in When and where.",
    },
    { key: "tickets", label: "At least one ticket type", done: e.ticketTypes.length > 0, hint: "Add a ticket type in Tickets." },
    {
      key: "payout",
      label: "Payout account verified",
      done: !hasPaid || e.organizer.payoutVerified,
      hint: "Paid tickets need a verified payout account. Free events don't.",
    },
    {
      key: "page",
      label: "Description and artwork",
      done: e.description.trim().length >= 20 && !!e.coverPreset,
      hint: "Write a description in Event page.",
    },
    {
      key: "refund",
      label: "Refund policy chosen",
      done: !hasPaid || !!e.refundUntil,
      hint: "Choose how long buyers can get a full refund.",
    },
  ];
}

/** Reasons a published-by-organizer event needs a human look before going live. */
export async function reviewFlag(e: EventForCheck): Promise<string> {
  if (e.organizer.verified) return "";
  const past = await db.event.count({
    where: { organizerId: e.organizerId, id: { not: e.id }, status: { in: ["PUBLISHED", "CANCELLED"] } },
  });
  const hasPaid = e.ticketTypes.some((t) => t.kind !== "FREE" && t.price > 0);
  if (e.capacity >= 2000 && !e.organizer.payoutVerified) return `${e.capacity.toLocaleString("en-US")} capacity, payout unverified`;
  // Same name + date + venue as a live listing from a *different* organizer.
  const dupe = await db.event.findFirst({
    where: {
      id: { not: e.id },
      organizerId: { not: e.organizerId },
      status: "PUBLISHED",
      title: e.title,
      venueName: e.venueName,
    },
    include: { organizer: true },
  });
  if (dupe) return "Possible impersonation";
  if (past === 0) return hasPaid ? "First event" : "First event";
  return "Unverified organizer";
}

export async function publishEvent(eventId: string) {
  const e = await db.event.findUnique({ where: { id: eventId }, include: { ticketTypes: true, organizer: true } });
  if (!e) throw new ApiError(404, "That event could not be found.");
  if (e.organizer.status === "SUSPENDED") throw new ApiError(403, "This organizer account is suspended.", "SUSPENDED");
  if (e.status === "CANCELLED") throw new ApiError(409, "A cancelled event can't be published again.");
  const missing = publishChecklist(e).filter((i) => !i.done);
  if (missing.length) {
    throw new ApiError(422, `${missing.length} step${missing.length === 1 ? "" : "s"} to go: ${missing.map((m) => m.label).join(", ")}.`, "NOT_READY");
  }
  if (e.startsAt < new Date()) throw new ApiError(422, "The start time is in the past.", "PAST", { startsAt: "Pick a future date." });

  const flag = await reviewFlag(e);
  const status = e.organizer.verified ? "PUBLISHED" : "PENDING_REVIEW";
  return db.event.update({
    where: { id: e.id },
    data: {
      status,
      flag: status === "PENDING_REVIEW" ? flag : "",
      submittedAt: status === "PENDING_REVIEW" ? new Date() : null,
      reviewReason: "",
      publishedAt: status === "PUBLISHED" ? (e.publishedAt ?? new Date()) : e.publishedAt,
    },
  });
}
