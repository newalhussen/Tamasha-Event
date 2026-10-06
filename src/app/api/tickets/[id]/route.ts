import { ApiError, notFound, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { assignTicketSchema } from "@/lib/validation";
import { z } from "zod";

/** Name the guest a ticket is for ("Send to a guest"). Only the ticket's owner, before check-in. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser(["ATTENDEE"]);
  const body = await parseBody(req, assignTicketSchema.or(z.object({ acknowledgeReschedule: z.literal(true) })));
  const ticket = await db.ticket.findUnique({ where: { id }, include: { event: true } });
  if (!ticket || ticket.ownerId !== user.id) throw notFound("That ticket");

  if ("acknowledgeReschedule" in body) {
    await db.ticket.updateMany({ where: { orderId: ticket.orderId, ownerId: user.id }, data: { rescheduleAck: true } });
    return { ok: true };
  }
  if (ticket.status !== "VALID") throw new ApiError(409, "This ticket can't be changed any more.", "LOCKED");
  await db.ticket.update({
    where: { id },
    data: { holderName: body.holderName, holderContact: body.holderContact ?? "" },
  });
  if (body.holderContact) {
    await notify({
      to: body.holderContact,
      channel: body.holderContact.includes("@") ? "email" : "sms",
      subject: `${user.name} sent you a ticket for ${ticket.event.title}`,
      body: `Open your ticket: /tickets/${ticket.code}`,
    });
  }
  return { ok: true };
});
