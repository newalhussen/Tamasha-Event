import type { Prisma } from "@prisma/client";
import { db } from "../db/prisma";
import { dateShort } from "../utils/format";

export type AttendeeStatusFilter = "all" | "in" | "not";

export type AttendeeQuery = {
  eventId: string;
  q?: string;
  status?: AttendeeStatusFilter;
  typeId?: string;
  page?: number;
  pageSize?: number;
};

export type AttendeeRow = {
  id: string;
  name: string;
  namedByBuyer: boolean;
  orderCode: string;
  seq: number;
  ofCount: number;
  ticketType: string;
  code: string;
  status: "VALID" | "CHECKED_IN" | "REFUNDED";
  checkedInAt: string | null;
  gate: string | null;
  note: string;
};

function where(q: AttendeeQuery): Prisma.TicketWhereInput {
  const w: Prisma.TicketWhereInput = { eventId: q.eventId, status: { in: ["VALID", "CHECKED_IN", "REFUNDED"] } };
  if (q.status === "in") w.status = "CHECKED_IN";
  if (q.status === "not") w.status = "VALID";
  if (q.typeId) w.ticketTypeId = q.typeId;
  const s = q.q?.trim();
  if (s) {
    w.OR = [
      { holderName: { contains: s, mode: "insensitive" } },
      { holderContact: { contains: s, mode: "insensitive" } },
      { code: { contains: s.toUpperCase() } },
      { order: { name: { contains: s, mode: "insensitive" } } },
      { order: { email: { contains: s, mode: "insensitive" } } },
      ...(/\d/.test(s) ? [{ order: { phone: { contains: s.replace(/\D/g, "") } } }] : []),
      { order: { code: { contains: s.toUpperCase() } } },
    ];
  }
  return w;
}

export async function listAttendees(q: AttendeeQuery) {
  const pageSize = q.pageSize ?? 8;
  const page = Math.max(1, q.page ?? 1);
  const w = where(q);
  const [rows, total, counts] = await Promise.all([
    db.ticket.findMany({
      where: w,
      include: { ticketType: true, order: { include: { _count: { select: { tickets: true } } } } },
      orderBy: [{ order: { createdAt: "desc" } }, { seq: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ticket.count({ where: w }),
    db.ticket.groupBy({ by: ["status"], where: { eventId: q.eventId, status: { in: ["VALID", "CHECKED_IN", "REFUNDED"] } }, _count: { _all: true } }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all])) as Record<string, number>;
  const checkedIn = c.CHECKED_IN ?? 0;
  const notYet = c.VALID ?? 0;
  const refunded = c.REFUNDED ?? 0;
  const items: AttendeeRow[] = rows.map((t) => ({
    id: t.id,
    name: t.holderName || `Guest of ${t.order.name || "buyer"}`,
    namedByBuyer: !!t.holderName,
    orderCode: t.order.code,
    seq: t.seq,
    ofCount: t.order._count.tickets,
    ticketType: t.ticketType.name,
    code: t.code,
    status: t.status as AttendeeRow["status"],
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
    gate: t.gate,
    note: t.holderName ? "" : "no name given",
  }));
  return { items, total, page, pageSize, counts: { all: checkedIn + notYet + refunded, checkedIn, notYet, refunded } };
}

const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralise spreadsheet formula injection from attacker-controlled names.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function attendeesCsv(eventId: string): Promise<string> {
  const tickets = await db.ticket.findMany({
    where: { eventId, status: { in: ["VALID", "CHECKED_IN", "REFUNDED"] } },
    include: { ticketType: true, order: true },
    orderBy: [{ order: { createdAt: "asc" } }, { seq: "asc" }],
  });
  const header = ["Name", "Email", "Phone", "Ticket type", "Ticket code", "Order", "Price (ETB)", "Status", "Checked in at", "Gate"];
  const lines = [header.map(csvCell).join(",")];
  for (const t of tickets) {
    lines.push(
      [
        t.holderName || `Guest of ${t.order.name}`,
        t.order.email,
        t.order.phone,
        t.ticketType.name,
        t.code,
        t.order.code,
        t.price,
        t.status === "CHECKED_IN" ? "Checked in" : t.status === "VALID" ? "Not arrived" : "Refunded",
        t.checkedInAt ? `${dateShort(t.checkedInAt)} ${t.checkedInAt.toISOString().slice(11, 16)}Z` : "",
        t.gate ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "﻿" + lines.join("\r\n");
}
