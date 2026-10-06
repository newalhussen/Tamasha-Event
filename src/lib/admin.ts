import "server-only";
import { db } from "./db";
import { includeRels, summarize, ticketCounts } from "./events";
import { waiting } from "./format";

export async function adminCounts() {
  const [events, organizers, reports] = await Promise.all([
    db.event.count({ where: { OR: [{ status: "PENDING_REVIEW" }, { flag: { not: "" } }, { reports: { some: { status: "OPEN" } } }] } }),
    db.organizer.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
  ]);
  return { events, organizers, reports };
}

export type QueueItem = {
  id: string;
  title: string;
  organizerId: string;
  organizerName: string;
  organizerNote: string;
  reason: string;
  tone: "danger" | "warn" | "neutral";
  waitingLabel: string;
  waitingMs: number;
};

/** Events that need a human: pending review, flagged after publish, or reported by people. */
export async function reviewQueue(now = new Date()): Promise<QueueItem[]> {
  const events = await db.event.findMany({
    where: { OR: [{ status: "PENDING_REVIEW" }, { flag: { not: "" } }, { reports: { some: { status: "OPEN" } } }] },
    include: { organizer: { include: { user: true, _count: { select: { events: true } } } }, reports: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } } },
  });
  const items = events.map((e): QueueItem => {
    const since = e.submittedAt ?? e.reports[0]?.createdAt ?? e.updatedAt;
    const reportsReason = e.reports.length ? `Reported by ${e.reports.length} ${e.reports.length === 1 ? "person" : "people"}` : "";
    const reason = e.flag || reportsReason || "Awaiting review";
    const past = e.organizer._count.events - 1;
    const note = `${e.organizer.name} · ${e.organizer.verified ? "verified" : past <= 0 ? "first event" : `${past} past ${past === 1 ? "event" : "events"}`}${past > 0 && e.organizer.verified ? ` · ${past} past events` : ""}`;
    const tone: QueueItem["tone"] = /impersonation|Reported/.test(reason) ? "danger" : /First event/.test(reason) ? "neutral" : "warn";
    return {
      id: e.id,
      title: e.title,
      organizerId: e.organizerId,
      organizerName: e.organizer.name,
      organizerNote: note,
      reason,
      tone,
      waitingLabel: waiting(since, now),
      waitingMs: now.getTime() - since.getTime(),
    };
  });
  return items.sort((a, b) => b.waitingMs - a.waitingMs);
}

export async function reviewDetail(eventId: string, now = new Date()) {
  const e = await db.event.findUnique({
    where: { id: eventId },
    include: { ...includeRels, organizer: { include: { user: true, _count: { select: { events: true } } } }, reports: { where: { status: "OPEN" }, include: { reporter: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!e) return null;
  const counts = await ticketCounts([e.id], now);
  const s = summarize(e, counts, now);
  const dupe = await db.event.findFirst({
    where: { id: { not: e.id }, organizerId: { not: e.organizerId }, status: "PUBLISHED", title: e.title, venueName: e.venueName },
    include: { organizer: true, ticketTypes: true },
  });
  const sold = s.sold;
  return { event: e, summary: s, dupe, sold };
}
