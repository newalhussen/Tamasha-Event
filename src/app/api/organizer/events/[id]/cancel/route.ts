import { ApiError, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { cancelEventAndRefund } from "@/lib/orders";

/** Cancel an event: every buyer is refunded in full and the event page shows it as cancelled. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  if (event.status === "CANCELLED") throw new ApiError(409, "This event is already cancelled.");
  if (event.status === "DRAFT") throw new ApiError(409, "Drafts can simply be deleted.");
  const res = await cancelEventAndRefund(id);
  return { ok: true, ...res };
});
