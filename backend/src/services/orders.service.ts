import type { Prisma } from "@prisma/client";
import { db } from "../db/prisma";
import { ApiError, notFound } from "../utils/errors";
import { FEE_RATE, HOLD_MINUTES, MAX_PER_ORDER } from "../utils/constants";
import { newOrderCode, newTicketCode } from "../utils/codes";
import { notify } from "./notify.service";
import { charge } from "./payments.service";
import { eventPhase, ticketCounts } from "./events.service";
import { normalizePhone } from "../utils/phone";
import { dateShort, timeLabel } from "../utils/format";
import { createAccount, type CurrentUser } from "./auth.service";

type Tx = Prisma.TransactionClient;

/* ---------------------------------------------------------------- holds */

/** Release checkouts whose 10-minute hold ran out so their tickets go back on sale. */
export async function expireStaleHolds(client: Tx | typeof db = db, now = new Date()) {
  const stale = await client.order.findMany({
    where: { status: "PENDING", holdExpiresAt: { lte: now } },
    select: { id: true },
  });
  if (stale.length === 0) return;
  const ids = stale.map((o) => o.id);
  await client.ticket.deleteMany({ where: { orderId: { in: ids }, status: "HELD" } });
  await client.order.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
}

export async function createHold(input: {
  eventId: string;
  items: { ticketTypeId: string; quantity: number; amount?: number }[];
  userId?: string;
  source?: string;
}) {
  const now = new Date();
  const totalQty = input.items.reduce((s, i) => s + i.quantity, 0);
  if (totalQty < 1) throw new ApiError(422, "Select at least one ticket.", "NO_TICKETS");
  if (totalQty > MAX_PER_ORDER) {
    throw new ApiError(422, `You can buy up to ${MAX_PER_ORDER} tickets per order.`, "TOO_MANY");
  }
  const dup = new Set(input.items.map((i) => i.ticketTypeId));
  if (dup.size !== input.items.length) throw new ApiError(422, "Each ticket type can only be listed once.");

  return db.$transaction(async (tx) => {
    // Serialise concurrent holds on the same event: the row lock is held until this transaction commits,
    // so two buyers can never both claim the last ticket.
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${input.eventId} FOR UPDATE`;
    await expireStaleHolds(tx, now);

    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      include: { ticketTypes: true, organizer: true },
    });
    if (!event || event.status !== "PUBLISHED" || event.organizer.status === "SUSPENDED") {
      throw new ApiError(404, "This event isn't on sale.", "NOT_ON_SALE");
    }
    if (eventPhase(event, now) === "ENDED") throw new ApiError(410, "This event has already finished.", "ENDED");
    if (event.salesEnd && event.salesEnd < now) throw new ApiError(410, "Ticket sales for this event have closed.", "SALES_CLOSED");

    // A buyer only ever holds one checkout per event: release their earlier one first.
    if (input.userId) {
      const earlier = await tx.order.findMany({
        where: { userId: input.userId, eventId: event.id, status: "PENDING" },
        select: { id: true },
      });
      if (earlier.length) {
        const ids = earlier.map((o) => o.id);
        await tx.ticket.deleteMany({ where: { orderId: { in: ids } } });
        await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
      }
    }

    const counts = await ticketCounts([event.id], now, tx);
    const rows: { type: (typeof event.ticketTypes)[number]; quantity: number; unit: number }[] = [];
    for (const item of input.items) {
      const type = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!type) throw new ApiError(422, "One of those tickets is no longer available.", "BAD_TYPE");
      if (type.saleStart && type.saleStart > now) throw new ApiError(409, `${type.name} isn't on sale yet.`, "NOT_YET");
      if (type.saleEnd && type.saleEnd < now) throw new ApiError(409, `${type.name} sales have ended.`, "ENDED");
      if (item.quantity > type.perOrderMax) {
        throw new ApiError(422, `${type.name}: up to ${type.perOrderMax} per order.`, "PER_ORDER");
      }
      const c = counts.get(type.id) ?? { sold: 0, held: 0 };
      const left = type.quantity - c.sold - c.held;
      if (item.quantity > left) {
        throw new ApiError(
          409,
          left <= 0 ? `${type.name} just sold out.` : `Only ${left} ${type.name} ticket${left === 1 ? "" : "s"} left.`,
          "SOLD_OUT",
        );
      }
      let unit = type.kind === "FREE" ? 0 : type.price;
      if (type.kind === "PWYW") {
        unit = Math.round(item.amount ?? type.price);
        if (unit < type.price) throw new ApiError(422, `${type.name}: the minimum is ETB ${type.price}.`, "BELOW_MIN");
        if (unit > 1_000_000) throw new ApiError(422, "That amount is too large.", "AMOUNT");
      }
      rows.push({ type, quantity: item.quantity, unit });
    }

    const total = rows.reduce((s, r) => s + r.unit * r.quantity, 0);
    let code = newOrderCode();
    while (await tx.order.findUnique({ where: { code } })) code = newOrderCode();

    const order = await tx.order.create({
      data: {
        code,
        userId: input.userId,
        eventId: event.id,
        total,
        source: sanitizeSource(input.source),
        holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
      },
    });
    let seq = 0;
    for (const r of rows) {
      for (let i = 0; i < r.quantity; i++) {
        await tx.ticket.create({
          data: {
            code: newTicketCode(),
            orderId: order.id,
            eventId: event.id,
            ticketTypeId: r.type.id,
            ownerId: input.userId,
            seq: ++seq,
            price: r.unit,
            status: "HELD",
          },
        });
      }
    }
    return order;
  });
}

const SOURCES = ["instagram", "whatsapp", "telegram", "discover", "direct", "facebook", "tiktok"];
export function sanitizeSource(s?: string): string {
  const v = (s ?? "direct").toLowerCase().trim();
  return SOURCES.includes(v) ? v : "other";
}

/* ---------------------------------------------------------------- checkout */

export async function loadCheckout(orderId: string, userId?: string) {
  await expireStaleHolds();
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      event: { include: { organizer: true } },
      tickets: { include: { ticketType: true }, orderBy: { seq: "asc" } },
    },
  });
  if (!order) return null;
  if (order.userId && order.userId !== userId) return null; // someone else's order
  return order;
}

export async function payOrder(input: {
  orderId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  holders: { name?: string; contact?: string }[];
  method?: "TELEBIRR" | "CBE_BIRR" | "CARD";
  payPhone?: string;
}) {
  const now = new Date();
  await expireStaleHolds();
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { event: true, tickets: { orderBy: { seq: "asc" } } },
  });
  if (!order || (order.userId && order.userId !== input.userId)) throw notFound("That order");
  if (order.status === "PAID") return { orderId: order.id, alreadyPaid: true };
  if (order.status !== "PENDING" || order.holdExpiresAt <= now) {
    throw new ApiError(410, "Your 10-minute hold ran out. Your details are saved.", "HOLD_EXPIRED");
  }

  const free = order.total === 0;
  if (!free && !input.method) throw new ApiError(422, "Choose how you'd like to pay.", "NO_METHOD", { method: "Choose a payment method." });
  if (!free && input.method !== "CARD" && !input.payPhone) {
    throw new ApiError(422, "Enter the number to send the payment prompt to.", "NO_PAY_PHONE", { payPhone: "Enter a mobile number." });
  }

  let reference: string | undefined;
  if (!free) {
    const result = await charge({
      method: input.method!,
      amount: order.total,
      phone: input.payPhone,
      orderCode: order.code,
    });
    if (!result.ok) {
      await db.order.update({ where: { id: order.id }, data: { paymentError: result.error, paymentMethod: input.method } });
      throw new ApiError(402, result.error, "PAYMENT_FAILED");
    }
    reference = result.reference;
  }

  await db.$transaction(async (tx) => {
    // Re-check the hold inside the transaction: expiry may have raced the payment.
    const fresh = await tx.order.findUnique({ where: { id: order.id } });
    if (!fresh || fresh.status !== "PENDING") throw new ApiError(410, "This order is no longer open.", "HOLD_EXPIRED");

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        userId: input.userId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        paymentMethod: free ? "FREE" : input.method,
        paymentRef: reference,
        paymentError: null,
        paidAt: now,
      },
    });
    for (const t of order.tickets) {
      const idx = t.seq - 1;
      const holder = idx === 0 ? { name: input.name, contact: input.email } : input.holders[idx - 1] ?? {};
      await tx.ticket.update({
        where: { id: t.id },
        data: {
          status: "VALID",
          ownerId: input.userId,
          holderName: holder.name?.trim() ?? "",
          holderContact: holder.contact?.trim() ?? "",
        },
      });
    }
  });

  await notify({
    to: input.email,
    channel: "email",
    subject: `Your tickets for ${order.event.title}`,
    body: `Order ${order.code}: ${order.tickets.length} ticket(s) for ${order.event.title}, ${dateShort(order.event.startsAt)} ${timeLabel(order.event.startsAt)}.`,
  });
  await notify({ to: input.phone, channel: "sms", body: `Tamasha: your ${order.tickets.length} ticket(s) for ${order.event.title} are ready. Order ${order.code}.` });

  return { orderId: order.id, alreadyPaid: false };
}

/* ---------------------------------------------------------------- refunds */

export function netOf(gross: number) {
  const fees = Math.round(gross * FEE_RATE);
  return { gross, fees, net: gross - fees };
}

export async function refundOrder(orderId: string, tx: Tx | typeof db = db) {
  const now = new Date();
  await tx.ticket.updateMany({ where: { orderId, status: { in: ["VALID", "HELD", "CHECKED_IN"] } }, data: { status: "REFUNDED", checkedInAt: null } });
  await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED", refundedAt: now } });
  await tx.refundRequest.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "APPROVED", decidedAt: now },
  });
}

/**
 * Attendee refund: instant while inside the event's refund window (and nobody has been checked in),
 * otherwise it becomes a request for the organizer to decide.
 */
export async function requestRefund(orderId: string, userId: string, reason?: string) {
  const now = new Date();
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: true },
  });
  if (!order || order.userId !== userId) throw notFound("That order");
  if (order.status !== "PAID") throw new ApiError(409, "This order can't be refunded.", "NOT_REFUNDABLE");
  if (order.tickets.some((t) => t.status === "CHECKED_IN")) {
    throw new ApiError(409, "Some tickets in this order were already used.", "ALREADY_USED");
  }
  if (eventPhase(order.event, now) === "ENDED") throw new ApiError(409, "This event has already finished.", "ENDED");

  const free = order.total === 0;
  // A rescheduled event always lets buyers walk away with a full refund.
  const inWindow = free || !!order.event.previousStartsAt || !order.event.refundUntil || order.event.refundUntil >= now;
  if (inWindow) {
    await refundOrder(order.id);
    return { refunded: true as const };
  }
  const existing = await db.refundRequest.findUnique({ where: { orderId: order.id } });
  if (existing) return { refunded: false as const, requested: true as const };
  await db.refundRequest.create({ data: { orderId: order.id, reason: reason ?? "" } });
  return { refunded: false as const, requested: true as const };
}

/** Event cancelled: refund every paid order in full and release open checkouts. */
export async function cancelEventAndRefund(eventId: string) {
  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: { status: "CANCELLED", cancelledAt: now } });
    const paid = await tx.order.findMany({ where: { eventId, status: "PAID" }, select: { id: true } });
    for (const o of paid) await refundOrder(o.id, tx);
    const pending = await tx.order.findMany({ where: { eventId, status: "PENDING" }, select: { id: true } });
    if (pending.length) {
      const ids = pending.map((o) => o.id);
      await tx.ticket.deleteMany({ where: { orderId: { in: ids } } });
      await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
    }
    return { refundedOrders: paid.length };
  });
}

/**
 * Pay for a held order. Signed-out buyers create their account inline (so checkout stays one page);
 * the caller starts a session for `createdUserId` when it is set.
 */
export async function payCheckout(
  user: CurrentUser | undefined,
  orderId: string,
  input: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    holders: { name?: string; contact?: string }[];
    method?: "TELEBIRR" | "CBE_BIRR" | "CARD";
    payPhone?: string;
  },
) {
  let userId = user?.id;
  let createdUserId: string | undefined;
  if (!user) {
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, "You already have an account with this email. Sign in to continue.", "EMAIL_TAKEN", {
        email: "You already have an account with this email.",
      });
    }
    if (!input.password || input.password.length < 8) {
      throw new ApiError(422, "Create a password of at least 8 characters to keep your tickets.", "PASSWORD", { password: "Use at least 8 characters." });
    }
    const created = await createAccount({ name: input.name, email: input.email, phone: input.phone, password: input.password });
    userId = createdUserId = created.id;
  } else if (user.role !== "ATTENDEE") {
    throw new ApiError(403, "Organizer and admin accounts can't buy tickets. Use an attendee account.", "STAFF_ACCOUNT");
  }

  const payPhone = input.payPhone ? normalizePhone(input.payPhone) : undefined;
  if (input.payPhone && !payPhone) {
    throw new ApiError(422, "Use an Ethiopian mobile number, like 0911 234 567.", "PAY_PHONE", { payPhone: "Use an Ethiopian mobile number." });
  }
  const result = await payOrder({
    orderId,
    userId: userId!,
    name: input.name,
    email: input.email,
    phone: input.phone,
    holders: input.holders,
    method: input.method,
    payPhone: payPhone ?? undefined,
  });
  return { ...result, createdUserId };
}
