import { db } from "../db/prisma";
import { ApiError, notFound } from "../utils/errors";
import { slugify } from "../utils/format";
import type { CurrentUser } from "./auth.service";
import { getManagedEvent } from "./access.service";
import { eventAnalytics } from "./analytics.service";
import { eventPhase, includeRels, summarize, ticketCounts, uniqueSlug } from "./events.service";
import { notify } from "./notify.service";
import { refundOrder } from "./orders.service";
import { publishChecklist } from "./publishing.service";

type OrgUser = CurrentUser & { organizer: NonNullable<CurrentUser["organizer"]> };

/* ------------------------------------------------------------------ events */

/** Step 1 of the wizard creates the draft; later steps PATCH it. */
export async function createDraft(orgId: string, input: { title: string; category: string; summary?: string }) {
  const slug = await uniqueSlug(slugify(input.title));
  const startsAt = new Date(Date.now() + 30 * 86_400_000);
  startsAt.setUTCHours(16, 0, 0, 0); // 7:00 PM Addis placeholder, replaced in "When and where"
  return db.event.create({
    data: { organizerId: orgId, slug, title: input.title, category: input.category, summary: input.summary ?? "", startsAt, capacity: 0, status: "DRAFT" },
  });
}

/** One event the organizer owns, with the numbers the dashboard pages need. */
export async function eventDetail(orgId: string, eventId: string) {
  const event = await db.event.findFirst({ where: { id: eventId, organizerId: orgId }, include: { ...includeRels } });
  if (!event) throw notFound("That event");
  const counts = await ticketCounts([eventId]);
  const soldCount = await db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } } });
  const { organizer: _organizer, ticketTypes: _types, ...fields } = event;
  void _organizer;
  void _types;
  return {
    event: fields,
    phase: eventPhase(event),
    summary: summarize(event, counts),
    checklist: publishChecklist({ ...event, organizer: event.organizer }).map(({ key, label, done }) => ({ key, label, done })),
    soldCount,
  };
}

export async function eventOverview(orgId: string, eventId: string) {
  await getOwnedEvent(orgId, eventId);
  const [analytics, recentOrders, checkedIn] = await Promise.all([
    eventAnalytics(eventId),
    db.order.findMany({
      where: { eventId, status: { in: ["PAID", "REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: { _count: { select: { tickets: true } } },
    }),
    db.ticket.count({ where: { eventId, status: "CHECKED_IN" } }),
  ]);
  const { event: _event, ...rest } = analytics;
  void _event;
  return { analytics: rest, recentOrders, checkedIn };
}

export async function eventAnalyticsView(orgId: string, eventId: string) {
  await getOwnedEvent(orgId, eventId);
  const { event: _event, ...rest } = await eventAnalytics(eventId);
  void _event;
  return rest;
}

async function getOwnedEvent(orgId: string, eventId: string) {
  const event = await db.event.findFirst({ where: { id: eventId, organizerId: orgId } });
  if (!event) throw notFound("That event");
  return event;
}

type Section =
  | { section: "basics"; data: { title: string; category: string; summary?: string } }
  | {
      section: "where";
      data: {
        startsAt: string;
        endsAt?: string | null;
        gatesAt?: string | null;
        venueName: string;
        venueAddress?: string;
        city: string;
        ageLimit: number;
        capacity: number;
      };
    }
  | {
      section: "page";
      data: {
        description: string;
        coverPreset: string;
        coverText?: string;
        lineup: { time: string; name: string; note?: string; headline?: boolean }[];
        info: { entry?: string; refunds?: string; accessibility?: string; gettingThere?: string };
        refundUntil?: string | null;
        salesEnd?: string | null;
      };
    };

/** Save one wizard section. Material changes to a live event are tracked for buyers and moderators. */
export async function updateEventSection(user: OrgUser, eventId: string, input: Section) {
  const event = await getManagedEvent(user, eventId);
  if (event.status === "CANCELLED") throw new ApiError(409, "A cancelled event can't be edited.");
  const live = event.status === "PUBLISHED";
  const soldTickets = live ? await db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } } }) : 0;

  if (input.section === "basics") {
    const d = input.data;
    await db.event.update({
      where: { id: eventId },
      data: {
        title: d.title,
        category: d.category,
        summary: d.summary ?? "",
        ...(d.title !== event.title && !live ? { slug: await uniqueSlug(slugify(d.title), eventId) } : {}),
      },
    });
  } else if (input.section === "where") {
    const d = input.data;
    const held = await db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN", "HELD"] } } });
    if (d.capacity < held) {
      throw new ApiError(422, `${held} tickets are already sold or held. Capacity can't be lower.`, "CAPACITY", {
        capacity: `At least ${held}, the tickets already sold.`,
      });
    }
    const startsAt = new Date(d.startsAt);
    const data: Record<string, unknown> = {
      startsAt,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      gatesAt: d.gatesAt ? new Date(d.gatesAt) : null,
      venueName: d.venueName,
      venueAddress: d.venueAddress ?? "",
      city: d.city,
      ageLimit: d.ageLimit,
      capacity: d.capacity,
    };
    if (live && soldTickets > 0) {
      if (startsAt.getTime() !== event.startsAt.getTime()) {
        data.previousStartsAt = event.previousStartsAt ?? event.startsAt;
        await db.ticket.updateMany({ where: { eventId, status: "VALID" }, data: { rescheduleAck: false } });
      }
      if (d.venueName.trim().toLowerCase() !== event.venueName.trim().toLowerCase()) {
        data.flag = `Venue changed after ${soldTickets} sales`;
        data.submittedAt = new Date();
      }
    }
    await db.event.update({ where: { id: eventId }, data });
  } else {
    const d = input.data;
    await db.event.update({
      where: { id: eventId },
      data: {
        description: d.description,
        coverPreset: d.coverPreset,
        coverText: d.coverText ?? "",
        lineup: d.lineup,
        info: d.info,
        refundUntil: d.refundUntil ? new Date(d.refundUntil) : null,
        salesEnd: d.salesEnd ? new Date(d.salesEnd) : null,
      },
    });
  }
}

export async function deleteDraft(user: OrgUser, eventId: string) {
  const event = await getManagedEvent(user, eventId);
  if (event.status !== "DRAFT") throw new ApiError(409, "Only drafts can be deleted. Cancel a published event instead.");
  await db.event.delete({ where: { id: eventId } });
}

/** Take an event off sale. Existing tickets stay valid; the event just leaves discovery. */
export async function unpublish(user: OrgUser, eventId: string) {
  const event = await getManagedEvent(user, eventId);
  if (!["PUBLISHED", "PENDING_REVIEW"].includes(event.status)) throw new ApiError(409, "This event isn't live.");
  await db.event.update({ where: { id: eventId }, data: { status: "DRAFT", flag: "" } });
}

/* ------------------------------------------------------------- ticket types */

type TicketInput = {
  name: string;
  kind: string;
  price: number;
  quantity: number;
  description?: string;
  perOrderMax: number;
  saleStart?: string | null;
  saleEnd?: string | null;
};

async function assertCapacity(eventId: string, capacity: number, quantity: number, excludeTypeId?: string) {
  const others = await db.ticketType.aggregate({
    where: { eventId, ...(excludeTypeId ? { id: { not: excludeTypeId } } : {}) },
    _sum: { quantity: true },
  });
  const used = others._sum.quantity ?? 0;
  if (capacity > 0 && used + quantity > capacity) {
    throw new ApiError(422, `That's ${used + quantity - capacity} more than the venue capacity of ${capacity}.`, "OVER_CAPACITY", {
      quantity: `Only ${Math.max(0, capacity - used)} left to allocate.`,
    });
  }
}

const typeData = (d: TicketInput) => ({
  name: d.name,
  kind: d.kind,
  price: d.kind === "FREE" ? 0 : d.price,
  quantity: d.quantity,
  description: d.description ?? "",
  perOrderMax: d.perOrderMax,
  saleStart: d.saleStart ? new Date(d.saleStart) : null,
  saleEnd: d.saleEnd ? new Date(d.saleEnd) : null,
});

export async function addTicketType(user: OrgUser, eventId: string, d: TicketInput) {
  const event = await getManagedEvent(user, eventId);
  if (event.status === "CANCELLED") throw new ApiError(409, "This event is cancelled.");
  await assertCapacity(eventId, event.capacity, d.quantity);
  const count = await db.ticketType.count({ where: { eventId } });
  return db.ticketType.create({ data: { eventId, sortOrder: count, ...typeData(d) } });
}

export async function updateTicketType(user: OrgUser, eventId: string, typeId: string, d: TicketInput) {
  const event = await getManagedEvent(user, eventId);
  const type = await db.ticketType.findFirst({ where: { id: typeId, eventId } });
  if (!type) throw notFound("That ticket type");
  const c = (await ticketCounts([eventId])).get(typeId) ?? { sold: 0, held: 0 };
  if (d.quantity < c.sold + c.held) {
    throw new ApiError(422, `${c.sold + c.held} of these are already sold or held.`, "BELOW_SOLD", {
      quantity: `At least ${c.sold + c.held}, the tickets already sold.`,
    });
  }
  await assertCapacity(eventId, event.capacity, d.quantity, typeId);
  // A new price applies to new orders only; existing tickets keep the price they were bought at.
  await db.ticketType.update({ where: { id: typeId }, data: typeData(d) });
}

export async function deleteTicketType(user: OrgUser, eventId: string, typeId: string) {
  await getManagedEvent(user, eventId);
  const type = await db.ticketType.findFirst({ where: { id: typeId, eventId } });
  if (!type) throw notFound("That ticket type");
  const used = await db.ticket.count({ where: { ticketTypeId: typeId, status: { in: ["VALID", "CHECKED_IN", "HELD"] } } });
  if (used > 0) throw new ApiError(409, "Tickets of this type have been sold. Set the quantity to what's sold to close it instead.", "HAS_SALES");
  await db.ticketType.delete({ where: { id: typeId } });
}

/* ------------------------------------------------------------------ people */

export async function messageAttendees(user: OrgUser, eventId: string, subject: string, body: string) {
  const event = await getManagedEvent(user, eventId);
  const orders = await db.order.findMany({
    where: { eventId, status: "PAID", tickets: { some: { status: { in: ["VALID", "CHECKED_IN"] } } } },
    select: { email: true },
    distinct: ["email"],
  });
  await Promise.all(orders.map((o) => notify({ to: o.email, channel: "email", subject: `${event.title}: ${subject}`, body })));
  return orders.length;
}

export async function decideRefund(orgId: string, requestId: string, decision: "APPROVE" | "DECLINE") {
  const request = await db.refundRequest.findUnique({ where: { id: requestId }, include: { order: { include: { event: true } } } });
  if (!request || request.order.event.organizerId !== orgId) throw notFound("That refund request");
  if (request.status !== "PENDING") throw new ApiError(409, "This request was already decided.");
  if (decision === "APPROVE") await refundOrder(request.orderId);
  else await db.refundRequest.update({ where: { id: requestId }, data: { status: "DECLINED", decidedAt: new Date() } });
}

export async function ordersPage(orgId: string, page: number, pageSize = 15) {
  const where = { event: { organizerId: orgId }, status: { in: ["PAID", "REFUNDED"] } };
  const [orders, total, requests] = await Promise.all([
    db.order.findMany({
      where,
      include: { event: { select: { title: true, id: true } }, _count: { select: { tickets: true } } },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.order.count({ where }),
    db.refundRequest.findMany({
      where: { status: "PENDING", order: { event: { organizerId: orgId } } },
      include: { order: { include: { event: true, _count: { select: { tickets: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { orders, total, page, pageSize, requests };
}

/* ----------------------------------------------------------------- profile */

export async function getProfile(orgId: string) {
  return db.organizer.findUniqueOrThrow({ where: { id: orgId } });
}

export async function updateProfile(
  orgId: string,
  input: { name: string; description?: string; payoutBank?: string; payoutAccount?: string },
) {
  const current = await db.organizer.findUniqueOrThrow({ where: { id: orgId } });
  const payoutChanged =
    (input.payoutAccount ?? current.payoutAccount ?? "") !== (current.payoutAccount ?? "") ||
    (input.payoutBank ?? current.payoutBank ?? "") !== (current.payoutBank ?? "");
  await db.organizer.update({
    where: { id: orgId },
    data: {
      name: input.name,
      description: input.description ?? current.description,
      payoutBank: input.payoutBank ?? current.payoutBank,
      payoutAccount: input.payoutAccount || current.payoutAccount,
      ...(payoutChanged ? { payoutVerified: false } : {}),
    },
  });
  return { payoutChanged };
}
