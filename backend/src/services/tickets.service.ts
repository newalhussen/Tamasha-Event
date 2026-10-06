import { db } from "../db/prisma";
import { normalizeTicketCode } from "../utils/codes";
import { ApiError, notFound } from "../utils/errors";
import { eventPhase } from "./events.service";
import { notify } from "./notify.service";

/** Name the guest a ticket is for, or confirm a rescheduled date. Only the ticket's owner, before check-in. */
export async function assignTicket(
  userId: string,
  userName: string,
  ticketId: string,
  input: { holderName: string; holderContact?: string } | { acknowledgeReschedule: true },
) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { event: true } });
  if (!ticket || ticket.ownerId !== userId) throw notFound("That ticket");

  if ("acknowledgeReschedule" in input) {
    await db.ticket.updateMany({ where: { orderId: ticket.orderId, ownerId: userId }, data: { rescheduleAck: true } });
    return;
  }
  if (ticket.status !== "VALID") throw new ApiError(409, "This ticket can't be changed any more.", "LOCKED");
  await db.ticket.update({ where: { id: ticketId }, data: { holderName: input.holderName, holderContact: input.holderContact ?? "" } });
  if (input.holderContact) {
    await notify({
      to: input.holderContact,
      channel: input.holderContact.includes("@") ? "email" : "sms",
      subject: `${userName} sent you a ticket for ${ticket.event.title}`,
      body: `Open your ticket: /tickets/${ticket.code}`,
    });
  }
}

/** Everything the "My tickets" page shows, already grouped. */
export async function myTickets(userId: string, now = new Date()) {
  const orders = await db.order.findMany({
    where: { userId, status: { in: ["PAID", "REFUNDED"] } },
    include: { event: true, tickets: { include: { ticketType: true }, orderBy: { seq: "asc" } }, refundRequest: true },
    orderBy: { event: { startsAt: "asc" } },
  });
  const upcoming = orders.filter((o) => o.status === "PAID" && eventPhase(o.event, now) !== "ENDED");
  const past = orders.filter((o) => o.status === "PAID" && eventPhase(o.event, now) === "ENDED").reverse();
  const refunded = orders.filter((o) => o.status === "REFUNDED").reverse();
  const cancelledNotices = refunded.filter(
    (o) => o.event.status === "CANCELLED" && now.getTime() - (o.refundedAt ?? o.createdAt).getTime() < 21 * 86_400_000,
  );
  return { upcoming, past, refunded, cancelledNotices };
}

export async function ticketByCode(userId: string, rawCode: string) {
  const code = normalizeTicketCode(rawCode);
  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { event: true, ticketType: true, order: { include: { tickets: { orderBy: { seq: "asc" }, select: { code: true, seq: true } } } } },
  });
  if (!ticket || ticket.ownerId !== userId || ticket.status === "HELD") throw notFound("That ticket");
  return ticket;
}

export async function orderConfirmation(userId: string, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { event: true, tickets: { include: { ticketType: true }, orderBy: { seq: "asc" } } },
  });
  if (!order || order.userId !== userId || order.status === "PENDING" || order.status === "EXPIRED") throw notFound("That order");
  return order;
}
