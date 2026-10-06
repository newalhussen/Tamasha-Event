import type { Event, Organizer, TicketType } from "@prisma/client";
import { db } from "./db";
import { toInputParts } from "./format";

const DAY = 86_400_000;

/* ---------------------------------------------------------------- availability */

export type TypeCounts = { sold: number; held: number };

/** Sold (valid or checked-in) and currently held (unexpired checkout) tickets per ticket type. */
export async function ticketCounts(eventIds: string[], now = new Date()): Promise<Map<string, TypeCounts>> {
  const map = new Map<string, TypeCounts>();
  if (eventIds.length === 0) return map;
  const [sold, held] = await Promise.all([
    db.ticket.groupBy({
      by: ["ticketTypeId"],
      where: { eventId: { in: eventIds }, status: { in: ["VALID", "CHECKED_IN"] } },
      _count: { _all: true },
    }),
    db.ticket.groupBy({
      by: ["ticketTypeId"],
      where: {
        eventId: { in: eventIds },
        status: "HELD",
        order: { status: "PENDING", holdExpiresAt: { gt: now } },
      },
      _count: { _all: true },
    }),
  ]);
  for (const r of sold) map.set(r.ticketTypeId, { sold: r._count._all, held: 0 });
  for (const r of held) {
    const cur = map.get(r.ticketTypeId) ?? { sold: 0, held: 0 };
    cur.held = r._count._all;
    map.set(r.ticketTypeId, cur);
  }
  return map;
}

export type TypeState = "ON_SALE" | "SOLD_OUT" | "NOT_YET" | "ENDED";

export type TicketTypeView = {
  id: string;
  name: string;
  kind: string;
  price: number;
  quantity: number;
  sold: number;
  held: number;
  left: number;
  description: string;
  perOrderMax: number;
  saleStart: string | null;
  saleEnd: string | null;
  state: TypeState;
};

export function typeView(t: TicketType, counts: TypeCounts | undefined, eventSalesEnd: Date | null, now = new Date()): TicketTypeView {
  const sold = counts?.sold ?? 0;
  const held = counts?.held ?? 0;
  const left = Math.max(0, t.quantity - sold - held);
  let state: TypeState = "ON_SALE";
  const end = t.saleEnd ?? eventSalesEnd;
  if (end && end.getTime() < now.getTime()) state = "ENDED";
  else if (t.saleStart && t.saleStart.getTime() > now.getTime()) state = "NOT_YET";
  else if (t.quantity - sold <= 0) state = "SOLD_OUT"; // truly gone (held tickets may still come back)
  else if (left <= 0) state = "SOLD_OUT";
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    price: t.price,
    quantity: t.quantity,
    sold,
    held,
    left,
    description: t.description,
    perOrderMax: t.perOrderMax,
    saleStart: t.saleStart?.toISOString() ?? null,
    saleEnd: t.saleEnd?.toISOString() ?? null,
    state,
  };
}

/* ---------------------------------------------------------------- summaries */

export type Phase = "UPCOMING" | "LIVE" | "ENDED";

export function eventPhase(e: Pick<Event, "startsAt" | "endsAt">, now = new Date()): Phase {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 6 * 3_600_000);
  if (now.getTime() >= end.getTime()) return "ENDED";
  if (now.getTime() >= e.startsAt.getTime()) return "LIVE";
  return "UPCOMING";
}

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  venueName: string;
  venueAddress: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  phase: Phase;
  coverPreset: string;
  coverText: string;
  organizerName: string;
  organizerVerified: boolean;
  capacity: number;
  totalQuantity: number;
  sold: number;
  left: number;
  soldPct: number;
  soldOut: boolean;
  free: boolean;
  minPrice: number;
  rescheduled: boolean;
  cancelled: boolean;
  types: TicketTypeView[];
};

type EventWithRels = Event & { organizer: Organizer; ticketTypes: TicketType[] };

export function summarize(e: EventWithRels, counts: Map<string, TypeCounts>, now = new Date()): EventSummary {
  const types = [...e.ticketTypes]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map((t) => typeView(t, counts.get(t.id), e.salesEnd, now));
  const totalQuantity = types.reduce((s, t) => s + t.quantity, 0);
  const sold = types.reduce((s, t) => s + t.sold, 0);
  const left = types.reduce((s, t) => s + (t.state === "ON_SALE" || t.state === "SOLD_OUT" ? t.left : 0), 0);
  const buyable = types.filter((t) => t.state === "ON_SALE" && t.left > 0);
  const priced = (buyable.length ? buyable : types).map((t) => (t.kind === "FREE" ? 0 : t.price));
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    category: e.category,
    summary: e.summary,
    venueName: e.venueName,
    venueAddress: e.venueAddress,
    city: e.city,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    status: e.status,
    phase: eventPhase(e, now),
    coverPreset: e.coverPreset,
    coverText: e.coverText,
    organizerName: e.organizer.name,
    organizerVerified: e.organizer.verified,
    capacity: e.capacity,
    totalQuantity,
    sold,
    left,
    soldPct: totalQuantity ? Math.round((sold / totalQuantity) * 100) : 0,
    soldOut: types.length > 0 && buyable.length === 0 && types.every((t) => t.state === "SOLD_OUT" || t.state === "ENDED"),
    free: types.length > 0 && priced.every((p) => p === 0),
    minPrice: priced.length ? Math.min(...priced) : 0,
    rescheduled: !!e.previousStartsAt,
    cancelled: e.status === "CANCELLED",
    types,
  };
}

const includeRels = { organizer: true, ticketTypes: true } as const;

/* ---------------------------------------------------------------- discovery */

export type When = "today" | "tomorrow" | "weekend" | "week" | "range" | "all";
export type PriceFilter = "any" | "free" | "under1000" | "1000to3000" | "over3000";
export type SortKey = "popular" | "date" | "price";

export type DiscoverQuery = {
  q?: string;
  when?: When;
  from?: string;
  to?: string;
  cat?: string;
  price?: PriceFilter;
  sort?: SortKey;
  limit?: number;
};

function addisMidnight(offsetDays: number, now = new Date()): Date {
  const { date } = toInputParts(new Date(now.getTime() + offsetDays * DAY));
  return new Date(`${date}T00:00:00+03:00`);
}

/** Addis weekday 0=Sun..6=Sat for `now` */
function addisWeekday(now = new Date()): number {
  const { date } = toInputParts(now);
  return new Date(`${date}T12:00:00+03:00`).getUTCDay();
}

export function whenRange(
  when: When | undefined,
  from?: string,
  to?: string,
  now = new Date(),
): { start: Date; end: Date; label: string } | null {
  switch (when) {
    case "today":
      return { start: addisMidnight(0, now), end: addisMidnight(1, now), label: "Today" };
    case "tomorrow":
      return { start: addisMidnight(1, now), end: addisMidnight(2, now), label: "Tomorrow" };
    case "weekend": {
      const wd = addisWeekday(now); // Sun0 ... Sat6
      const toFri = wd === 0 ? -2 : wd === 6 ? -1 : 5 - wd; // current weekend if we're in it
      const fri = addisMidnight(toFri, now);
      return { start: fri, end: new Date(fri.getTime() + 3 * DAY), label: "This weekend" };
    }
    case "week": {
      const wd = addisWeekday(now);
      const toNextMon = ((8 - wd) % 7) || 7;
      const mon = addisMidnight(toNextMon, now);
      return { start: mon, end: new Date(mon.getTime() + 7 * DAY), label: "Next week" };
    }
    case "range": {
      if (!from) return null;
      const start = new Date(`${from}T00:00:00+03:00`);
      const end = new Date(`${to || from}T00:00:00+03:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return { start, end: new Date(end.getTime() + DAY), label: "Selected dates" };
    }
    default:
      return null;
  }
}

/** Public, bookable-or-browsable events (published, not hidden by a suspended organizer, not yet over). */
function publicWhere(now: Date) {
  return {
    status: "PUBLISHED",
    organizer: { status: { not: "SUSPENDED" } },
    OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: new Date(now.getTime() - 6 * 3_600_000) } }],
  } as const;
}

export async function discoverEvents(query: DiscoverQuery, now = new Date()) {
  const range = whenRange(query.when, query.from, query.to, now);
  const where: any = { ...publicWhere(now) };
  const and: any[] = [];
  if (range) and.push({ startsAt: { gte: range.start, lt: range.end } });
  if (query.cat && query.cat !== "all") and.push({ category: query.cat });
  if (query.q?.trim()) {
    const q = query.q.trim();
    and.push({
      OR: [
        { title: { contains: q } },
        { venueName: { contains: q } },
        { venueAddress: { contains: q } },
        { summary: { contains: q } },
        { category: { contains: q } },
        { organizer: { name: { contains: q } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const rows = await db.event.findMany({ where, include: includeRels, orderBy: { startsAt: "asc" } });
  const counts = await ticketCounts(rows.map((r) => r.id), now);
  let list = rows.map((r) => summarize(r, counts, now)).filter((e) => e.types.length > 0);

  switch (query.price) {
    case "free":
      list = list.filter((e) => e.free);
      break;
    case "under1000":
      list = list.filter((e) => !e.free && e.minPrice < 1000);
      break;
    case "1000to3000":
      list = list.filter((e) => e.minPrice >= 1000 && e.minPrice <= 3000);
      break;
    case "over3000":
      list = list.filter((e) => e.minPrice > 3000);
      break;
  }

  const sort = query.sort ?? "popular";
  if (sort === "popular") list.sort((a, b) => b.sold - a.sold || a.startsAt.localeCompare(b.startsAt));
  else if (sort === "price") list.sort((a, b) => a.minPrice - b.minPrice || a.startsAt.localeCompare(b.startsAt));

  const total = list.length;
  const featured = list.find((e) => !e.soldOut) ?? list[0] ?? null;
  const goingFast = list
    .filter((e) => !e.soldOut && e.totalQuantity > 0 && e.left / e.totalQuantity < 0.2 && !e.free)
    .sort((a, b) => a.left - b.left);
  const goingFastAll = list
    .filter((e) => !e.soldOut && e.totalQuantity > 0 && e.left / e.totalQuantity < 0.2)
    .sort((a, b) => a.left - b.left);
  const limit = Math.min(Math.max(query.limit ?? 8, 1), 60);
  const grid = list.filter((e) => e.id !== featured?.id);
  return {
    total,
    featured,
    goingFast: goingFastAll.slice(0, 4),
    goingFastCount: goingFastAll.length,
    grid: grid.slice(0, limit),
    gridTotal: grid.length,
    rangeLabel: range?.label ?? null,
    range,
    unused: goingFast.length,
  };
}

export async function cityCategoryCounts(now = new Date()) {
  const rows = await db.event.groupBy({
    by: ["category"],
    where: publicWhere(now) as any,
    _count: { _all: true },
  });
  return rows.map((r) => ({ category: r.category, count: r._count._all }));
}

/* ---------------------------------------------------------------- detail */

export async function getPublicEvent(slug: string, viewerCanSeeDraft: { organizerId?: string; admin?: boolean } = {}, now = new Date()) {
  const e = await db.event.findUnique({ where: { slug }, include: includeRels });
  if (!e) return null;
  const isOwner = viewerCanSeeDraft.organizerId === e.organizerId;
  const visible = e.status === "PUBLISHED" || e.status === "CANCELLED" || isOwner || viewerCanSeeDraft.admin;
  if (!visible) return null;
  if (e.organizer.status === "SUSPENDED" && !isOwner && !viewerCanSeeDraft.admin) return null;
  const counts = await ticketCounts([e.id], now);
  const hostedCount = await db.event.count({ where: { organizerId: e.organizerId, status: { in: ["PUBLISHED", "CANCELLED"] } } });
  const similar = await db.event.findMany({
    where: { AND: [publicWhere(now) as any, { id: { not: e.id } }, { OR: [{ category: e.category }, { organizerId: e.organizerId }] }] },
    include: includeRels,
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  const simCounts = await ticketCounts(similar.map((s) => s.id), now);
  return {
    event: e,
    summary: summarize(e, counts, now),
    hostedCount,
    similar: similar.map((s) => summarize(s, simCounts, now)),
    lineup: safeJson<Array<{ time: string; name: string; note?: string; headline?: boolean }>>(e.lineup, []),
    info: safeJson<{ entry?: string; refunds?: string; accessibility?: string; gettingThere?: string }>(e.info, {}),
  };
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let i = 2;
  for (;;) {
    const hit = await db.event.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

export { includeRels };
