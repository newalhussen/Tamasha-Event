import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { getManagedEvent } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { checkInById, checkInProgress, undoCheckIn } from "@/lib/checkin";

/** Manual check-in from the attendee list. */
export const POST = route<{ id: string; ticketId: string }>(async (req, { params }) => {
  const { id, ticketId } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  const { gate } = await parseBody(req, z.object({ gate: z.string().max(30).optional() }));
  const result = await checkInById(id, ticketId, user.id, gate || "Front desk");
  return { result, progress: await checkInProgress(id) };
});

export const DELETE = route<{ id: string; ticketId: string }>(async (_req, { params }) => {
  const { id, ticketId } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  const undone = await undoCheckIn(id, ticketId);
  return { undone, progress: await checkInProgress(id) };
});
