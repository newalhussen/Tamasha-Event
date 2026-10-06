import { ApiError, parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketTypeSchema } from "@/lib/validation";

async function assertCapacity(eventId: string, capacity: number, newQuantity: number, excludeTypeId?: string) {
  const others = await db.ticketType.aggregate({
    where: { eventId, ...(excludeTypeId ? { id: { not: excludeTypeId } } : {}) },
    _sum: { quantity: true },
  });
  const total = (others._sum.quantity ?? 0) + newQuantity;
  if (capacity > 0 && total > capacity) {
    throw new ApiError(422, `That's ${total - capacity} more than the venue capacity of ${capacity}.`, "OVER_CAPACITY", {
      quantity: `Only ${capacity - (total - newQuantity)} left to allocate.`,
    });
  }
}

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  if (event.status === "CANCELLED") throw new ApiError(409, "This event is cancelled.");
  const d = await parseBody(req, ticketTypeSchema);
  await assertCapacity(id, event.capacity, d.quantity);
  const count = await db.ticketType.count({ where: { eventId: id } });
  const type = await db.ticketType.create({
    data: {
      eventId: id,
      name: d.name,
      kind: d.kind,
      price: d.kind === "FREE" ? 0 : d.price,
      quantity: d.quantity,
      description: d.description ?? "",
      perOrderMax: d.perOrderMax,
      saleStart: d.saleStart ? new Date(d.saleStart) : null,
      saleEnd: d.saleEnd ? new Date(d.saleEnd) : null,
      sortOrder: count,
    },
  });
  return { id: type.id };
});
