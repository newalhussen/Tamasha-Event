import { ApiError, notFound, parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketCounts } from "@/lib/events";
import { ticketTypeSchema } from "@/lib/validation";

async function load(eventId: string, typeId: string) {
  const type = await db.ticketType.findFirst({ where: { id: typeId, eventId } });
  if (!type) throw notFound("That ticket type");
  return type;
}

export const PATCH = route<{ id: string; typeId: string }>(async (req, { params }) => {
  const { id, typeId } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  const type = await load(id, typeId);
  const d = await parseBody(req, ticketTypeSchema);

  const c = (await ticketCounts([id])).get(typeId) ?? { sold: 0, held: 0 };
  if (d.quantity < c.sold + c.held) {
    throw new ApiError(422, `${c.sold + c.held} of these are already sold or held.`, "BELOW_SOLD", {
      quantity: `At least ${c.sold + c.held}, the tickets already sold.`,
    });
  }
  // Changing the price under existing buyers would make receipts inconsistent; new price applies to new orders only.
  const others = await db.ticketType.aggregate({ where: { eventId: id, id: { not: typeId } }, _sum: { quantity: true } });
  const total = (others._sum.quantity ?? 0) + d.quantity;
  if (event.capacity > 0 && total > event.capacity) {
    throw new ApiError(422, `That's ${total - event.capacity} more than the venue capacity of ${event.capacity}.`, "OVER_CAPACITY", {
      quantity: `Only ${event.capacity - (others._sum.quantity ?? 0)} left to allocate.`,
    });
  }
  await db.ticketType.update({
    where: { id: type.id },
    data: {
      name: d.name,
      kind: d.kind,
      price: d.kind === "FREE" ? 0 : d.price,
      quantity: d.quantity,
      description: d.description ?? "",
      perOrderMax: d.perOrderMax,
      saleStart: d.saleStart ? new Date(d.saleStart) : null,
      saleEnd: d.saleEnd ? new Date(d.saleEnd) : null,
    },
  });
  return { ok: true };
});

export const DELETE = route<{ id: string; typeId: string }>(async (_req, { params }) => {
  const { id, typeId } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  await load(id, typeId);
  const used = await db.ticket.count({ where: { ticketTypeId: typeId, status: { in: ["VALID", "CHECKED_IN", "HELD"] } } });
  if (used > 0) {
    throw new ApiError(409, "Tickets of this type have been sold. Set the quantity to what's sold to close it instead.", "HAS_SALES");
  }
  await db.ticketType.delete({ where: { id: typeId } });
  return { ok: true };
});
