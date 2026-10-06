import { db } from "../db/prisma";
import { normalizeTicketCode } from "../utils/codes";
import { dateShort, timeLabel } from "../utils/format";

export type ScanResult =
  | { kind: "OK"; ticket: ScanTicket; at: string }
  | { kind: "ALREADY"; ticket: ScanTicket; at: string; gate: string | null; by: string | null }
  | { kind: "WRONG_EVENT"; other: { title: string; when: string } }
  | { kind: "INVALID"; ticket: ScanTicket; reason: string }
  | { kind: "NOT_FOUND" };

export type ScanTicket = {
  id: string;
  code: string;
  holder: string;
  ticketType: string;
  seq: number;
  ofCount: number;
  orderCode: string;
  ageLimit: number;
};

const ticketInclude = {
  ticketType: true,
  order: { include: { _count: { select: { tickets: true } } } },
  event: true,
  checkedInBy: true,
} as const;

function toScanTicket(t: any): ScanTicket {
  return {
    id: t.id,
    code: t.code,
    holder: t.holderName || `Guest of ${t.order.name || "ticket buyer"}`,
    ticketType: t.ticketType.name,
    seq: t.seq,
    ofCount: t.order._count.tickets,
    orderCode: t.order.code,
    ageLimit: t.event.ageLimit,
  };
}

/** Validate a scanned/typed code against an event and, if valid, check the ticket in atomically. */
export async function checkInByCode(eventId: string, rawCode: string, userId: string, gate?: string): Promise<ScanResult> {
  const code = normalizeTicketCode(rawCode);
  const ticket = await db.ticket.findUnique({ where: { code }, include: ticketInclude });
  if (!ticket || ticket.status === "HELD") return { kind: "NOT_FOUND" };

  if (ticket.eventId !== eventId) {
    return { kind: "WRONG_EVENT", other: { title: ticket.event.title, when: `${dateShort(ticket.event.startsAt)} ${timeLabel(ticket.event.startsAt)}` } };
  }
  const st = toScanTicket(ticket);
  if (ticket.status === "REFUNDED") return { kind: "INVALID", ticket: st, reason: "Ticket no longer valid (refunded)" };
  if (ticket.status === "CHECKED_IN") {
    return { kind: "ALREADY", ticket: st, at: ticket.checkedInAt?.toISOString() ?? "", gate: ticket.gate, by: ticket.checkedInBy?.name ?? null };
  }

  const now = new Date();
  // Compare-and-set: if two scanners race on the same ticket, only one wins.
  const res = await db.ticket.updateMany({
    where: { id: ticket.id, status: "VALID" },
    data: { status: "CHECKED_IN", checkedInAt: now, checkedInById: userId, gate: gate || null },
  });
  if (res.count === 0) {
    const again = await db.ticket.findUnique({ where: { id: ticket.id }, include: ticketInclude });
    return { kind: "ALREADY", ticket: st, at: again?.checkedInAt?.toISOString() ?? now.toISOString(), gate: again?.gate ?? null, by: again?.checkedInBy?.name ?? null };
  }
  return { kind: "OK", ticket: st, at: now.toISOString() };
}

export async function checkInById(eventId: string, ticketId: string, userId: string, gate?: string) {
  const t = await db.ticket.findFirst({ where: { id: ticketId, eventId } });
  if (!t) return { kind: "NOT_FOUND" as const };
  return checkInByCode(eventId, t.code, userId, gate);
}

export async function undoCheckIn(eventId: string, ticketId: string) {
  const res = await db.ticket.updateMany({
    where: { id: ticketId, eventId, status: "CHECKED_IN" },
    data: { status: "VALID", checkedInAt: null, checkedInById: null, gate: null },
  });
  return res.count > 0;
}

export async function checkInProgress(eventId: string) {
  const [total, checked, last, byGate, byTypeRaw, types] = await Promise.all([
    db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } } }),
    db.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
    db.ticket.findFirst({ where: { eventId, status: "CHECKED_IN" }, orderBy: { checkedInAt: "desc" }, include: { checkedInBy: true } }),
    db.ticket.groupBy({ by: ["gate", "checkedInById"], where: { eventId, status: "CHECKED_IN" }, _count: { _all: true } }),
    db.ticket.groupBy({ by: ["ticketTypeId", "status"], where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } }, _count: { _all: true } }),
    db.ticketType.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const byType = types
    .map((t) => {
      const rows = byTypeRaw.filter((r) => r.ticketTypeId === t.id);
      const checkedN = rows.find((r) => r.status === "CHECKED_IN")?._count._all ?? 0;
      const validN = rows.find((r) => r.status === "VALID")?._count._all ?? 0;
      return { id: t.id, name: t.name, checked: checkedN, total: checkedN + validN };
    })
    .filter((t) => t.total > 0);
  const staff = await db.user.findMany({ where: { id: { in: byGate.map((g) => g.checkedInById).filter(Boolean) as string[] } }, select: { id: true, name: true } });
  return {
    total,
    checked,
    byType,
    last: last ? { at: last.checkedInAt!.toISOString(), gate: last.gate } : null,
    gates: byGate.map((g) => ({
      gate: g.gate ?? "No gate",
      by: staff.find((s) => s.id === g.checkedInById)?.name ?? "Staff",
      scans: g._count._all,
    })),
  };
}
