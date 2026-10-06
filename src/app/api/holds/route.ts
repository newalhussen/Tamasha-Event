import { parseBody, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createHold } from "@/lib/orders";
import { holdSchema } from "@/lib/validation";

/** Start checkout: reserve the chosen tickets for 10 minutes. Guests may hold; paying creates the account. */
export const POST = route(async (req) => {
  const input = await parseBody(req, holdSchema);
  const user = await getCurrentUser();
  // Staff accounts can't buy: organizers manage events, admins moderate.
  const order = await createHold({
    eventId: input.eventId,
    items: input.items,
    userId: user?.id,
    source: input.source,
  });
  return { orderId: order.id, holdExpiresAt: order.holdExpiresAt.toISOString() };
});
