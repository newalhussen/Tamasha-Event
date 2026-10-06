import { db } from "../db/prisma";
import { eventPhase, includeRels, summarize, ticketCounts, type EventSummary } from "./events.service";
import { FEE_RATE } from "../utils/constants";
import { toInputParts } from "../utils/format";

const DAY = 86_400_000;
const live = ["VALID", "CHECKED_IN"];

const dayKey = (d: Date) => toInputParts(d).date;

function lastDays(n: number, now = new Date()): { key: string; date: Date }[] {
  const out: { key: string; date: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    out.push({ key: dayKey(d), date: d });
  }
  return out;
}

export const SOURCE_LABEL: Record<string, string> = {
  instagram: "Instagram",
  discover: "Tamasha discover",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  facebook: "Facebook",
  tiktok: "TikTok",
  direct: "Direct link",
  other: "Other",
};

export function feeOf(gross: number) {
  const fees = Math.round(gross * FEE_RATE);
  return { gross, fees, net: gross - fees };
}

/** Gross sales (ETB) of live tickets per event. */
async function grossByEvent(eventIds: string[]): Promise<Map<string, number>> {
  const rows = await db.ticket.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: { in: live } },
    _sum: { price: true },
  });
  return new Map(rows.map((r) => [r.eventId, r._sum.price ?? 0]));
}

export type OrgEventRow = EventSummary & { gross: number; checkedIn: number; flag: string; reviewReason: string; ticketTypeCount: number };

export async function organizerEvents(organizerId: string, now = new Date()): Promise<OrgEventRow[]> {
  const rows = await db.event.findMany({
    where: { organizerId },
    include: includeRels,
    orderBy: { startsAt: "asc" },
  });
  const counts = await ticketCounts(rows.map((r) => r.id), now);
  const gross = await grossByEvent(rows.map((r) => r.id));
  const checked = await db.ticket.groupBy({
    by: ["eventId"],
    where: { eventId: { in: rows.map((r) => r.id) }, status: "CHECKED_IN" },
    _count: { _all: true },
  });
  const checkedMap = new Map(checked.map((c) => [c.eventId, c._count._all]));
  return rows.map((r) => ({
    ...summarize(r, counts, now),
    gross: gross.get(r.id) ?? 0,
    checkedIn: checkedMap.get(r.id) ?? 0,
    flag: r.flag,
    reviewReason: r.reviewReason,
    ticketTypeCount: r.ticketTypes.length,
  }));
}

export async function salesPerDay(eventIds: string[], days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const orders = await db.order.findMany({
    where: { eventId: { in: eventIds }, status: { in: ["PAID", "REFUNDED"] }, paidAt: { gte: since } },
    select: { paidAt: true, _count: { select: { tickets: true } } },
  });
  const buckets = new Map<string, number>();
  for (const o of orders) {
    if (!o.paidAt) continue;
    const k = dayKey(o.paidAt);
    buckets.set(k, (buckets.get(k) ?? 0) + o._count.tickets);
  }
  return lastDays(days, now).map(({ key, date }) => ({ key, date: date.toISOString(), tickets: buckets.get(key) ?? 0 }));
}

export async function organizerDashboard(organizerId: string, now = new Date()) {
  const events = await organizerEvents(organizerId, now);
  const published = events.filter((e) => e.status === "PUBLISHED");
  const upcoming = published.filter((e) => e.phase !== "ENDED");
  const next = upcoming[0] ?? null;
  const ids = events.map((e) => e.id);

  const win = async (from: Date, to: Date) => {
    const paid = await db.ticket.aggregate({
      where: { eventId: { in: ids }, status: { in: live }, order: { paidAt: { gte: from, lt: to } } },
      _sum: { price: true },
      _count: { _all: true },
    });
    const gross = paid._sum.price ?? 0;
    return { gross, net: gross - Math.round(gross * FEE_RATE), tickets: paid._count._all };
  };
  const [cur, prev] = ids.length
    ? await Promise.all([win(new Date(now.getTime() - 30 * DAY), now), win(new Date(now.getTime() - 60 * DAY), new Date(now.getTime() - 30 * DAY))])
    : [{ gross: 0, net: 0, tickets: 0 }, { gross: 0, net: 0, tickets: 0 }];
  const change = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

  const lastEnded = [...events].reverse().find((e) => e.phase === "ENDED" && e.status === "PUBLISHED" && e.sold > 0);
  const turnUp = lastEnded ? Math.round((lastEnded.checkedIn / lastEnded.sold) * 100) : null;

  const chartIds = next ? [next.id] : ids;
  const chart = ids.length ? await salesPerDay(chartIds, 14, now) : [];

  const refundRequests = await db.refundRequest.findMany({
    where: { status: "PENDING", order: { eventId: { in: ids } } },
    include: { order: { include: { event: true } } },
    orderBy: { createdAt: "asc" },
  });
  const lowStock = upcoming.flatMap((e) =>
    e.types.filter((t) => t.state === "ON_SALE" && t.left > 0 && t.left <= Math.max(10, Math.round(t.quantity * 0.1))).map((t) => ({ event: e, type: t })),
  );
  const drafts = events.filter((e) => e.status === "DRAFT");

  // Payouts: paid out 3 days after an event ends. Show the soonest one that is still ahead.
  const payoutDate = (e: OrgEventRow) => new Date((e.endsAt ? new Date(e.endsAt) : new Date(new Date(e.startsAt).getTime() + 6 * 3_600_000)).getTime() + 3 * DAY);
  const payable = published.filter((e) => e.gross > 0 && payoutDate(e) >= now).sort((a, b) => payoutDate(a).getTime() - payoutDate(b).getTime());
  const nextPayout = payable[0] ? { event: payable[0], amount: feeOf(payable[0].gross).net, date: payoutDate(payable[0]).toISOString() } : null;

  return {
    events,
    next,
    liveCount: published.filter((e) => e.phase !== "ENDED").length,
    drafts,
    cur,
    prev,
    netChange: change(cur.net, prev.net),
    ticketChange: change(cur.tickets, prev.tickets),
    turnUp,
    chart,
    chartEvent: next,
    refundRequests,
    lowStock,
    nextPayout,
  };
}

export async function eventAnalytics(eventId: string, now = new Date()) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: includeRels });
  const counts = await ticketCounts([eventId], now);
  const summary = summarize(event, counts, now);

  const orders = await db.order.findMany({
    where: { eventId, status: "PAID" },
    select: { paidAt: true, total: true, source: true, tickets: { select: { ticketTypeId: true, price: true, status: true } } },
    orderBy: { paidAt: "asc" },
  });
  const gross = orders.reduce((s, o) => s + o.tickets.filter((t) => live.includes(t.status)).reduce((a, t) => a + t.price, 0), 0);
  const { fees, net } = feeOf(gross);
  const [views, started, refundedOrders] = await Promise.all([
    db.eventView.count({ where: { eventId } }),
    db.order.count({ where: { eventId } }),
    db.order.count({ where: { eventId, status: "REFUNDED" } }),
  ]);
  const completed = orders.length + refundedOrders;

  // Cumulative tickets sold per day from the first sale until today.
  const start = orders[0]?.paidAt ?? event.publishedAt ?? event.createdAt;
  const startDay = new Date(`${dayKey(start)}T00:00:00+03:00`);
  const endAt = event.startsAt < now ? event.startsAt : now;
  const spanDays = Math.max(1, Math.min(120, Math.ceil((endAt.getTime() - startDay.getTime()) / DAY) + 1));
  const perDay = new Map<string, number>();
  for (const o of orders) if (o.paidAt) perDay.set(dayKey(o.paidAt), (perDay.get(dayKey(o.paidAt)) ?? 0) + o.tickets.length);
  const series: { key: string; date: string; total: number; day: number }[] = [];
  let running = 0;
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(startDay.getTime() + i * DAY + 12 * 3_600_000);
    const k = dayKey(d);
    const day = perDay.get(k) ?? 0;
    running += day;
    series.push({ key: k, date: d.toISOString(), total: running, day });
  }

  // When did each ticket type sell out?
  const soldOutMarks = summary.types
    .filter((t) => t.sold >= t.quantity && t.quantity > 0)
    .map((t) => {
      let n = 0;
      let date: string | null = null;
      for (const o of orders) {
        n += o.tickets.filter((x) => x.ticketTypeId === t.id).length;
        if (n >= t.quantity && o.paidAt) {
          date = o.paidAt.toISOString();
          break;
        }
      }
      return { name: t.name, quantity: t.quantity, date };
    })
    .filter((m) => m.date);

  // Pace over the last 7 days -> projected sell-out date.
  const last7 = series.slice(-7).reduce((s, p) => s + p.day, 0);
  const pace = last7 / Math.min(7, series.length || 1);
  const remaining = Math.max(0, summary.totalQuantity - summary.sold);
  const projected = pace > 0.5 && remaining > 0 && summary.phase === "UPCOMING" ? new Date(now.getTime() + Math.ceil(remaining / pace) * DAY) : null;

  const byTypeGross = new Map<string, number>();
  for (const o of orders) for (const t of o.tickets) if (live.includes(t.status)) byTypeGross.set(t.ticketTypeId, (byTypeGross.get(t.ticketTypeId) ?? 0) + t.price);

  const sources = new Map<string, number>();
  for (const o of orders) sources.set(o.source, (sources.get(o.source) ?? 0) + 1);
  const sourceRows = [...sources.entries()]
    .map(([key, count]) => ({ key, label: SOURCE_LABEL[key] ?? "Other", count }))
    .sort((a, b) => b.count - a.count);

  return {
    event,
    summary,
    orders: orders.length,
    avgOrder: orders.length ? Math.round(gross / orders.length) : 0,
    gross,
    fees,
    net,
    views,
    started,
    completed,
    conversion: views ? Math.round((completed / views) * 1000) / 10 : 0,
    startedRate: views ? Math.round((started / views) * 1000) / 10 : 0,
    completionRate: started ? Math.round((completed / started) * 100) : 0,
    abandoned: Math.max(0, started - completed - (await db.order.count({ where: { eventId, status: "PENDING", holdExpiresAt: { gt: now } } }))),
    series,
    soldOutMarks,
    projected: projected?.toISOString() ?? null,
    byType: summary.types.map((t) => ({ ...t, gross: byTypeGross.get(t.id) ?? 0 })),
    sources: sourceRows,
    phase: eventPhase(event, now),
  };
}

export async function organizerPayouts(organizerId: string, now = new Date()) {
  const events = await organizerEvents(organizerId, now);
  return events
    .filter((e) => e.status === "PUBLISHED" || e.status === "CANCELLED")
    .map((e) => {
      const end = e.endsAt ? new Date(e.endsAt) : new Date(new Date(e.startsAt).getTime() + 6 * 3_600_000);
      const date = new Date(end.getTime() + 3 * DAY);
      const f = feeOf(e.gross);
      return { event: e, ...f, date: date.toISOString(), paid: date < now };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
