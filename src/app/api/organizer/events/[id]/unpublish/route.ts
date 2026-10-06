import { ApiError, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { db } from "@/lib/db";

/** Take an event off sale. Existing tickets stay valid; the event just leaves discovery. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  if (!["PUBLISHED", "PENDING_REVIEW"].includes(event.status)) throw new ApiError(409, "This event isn't live.");
  await db.event.update({ where: { id }, data: { status: "DRAFT", flag: "" } });
  return { ok: true };
});
