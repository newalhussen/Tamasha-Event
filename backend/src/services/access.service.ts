import type { Event } from "@prisma/client";
import { db } from "../db/prisma";
import { forbidden, notFound } from "../utils/errors";
import type { CurrentUser } from "./auth.service";

/** Load an event the user is allowed to manage (its organizer, or an admin for read/moderation paths). */
export async function getManagedEvent(
  user: CurrentUser,
  eventId: string,
  opts: { allowAdmin?: boolean } = {},
): Promise<Event> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound("That event");
  const owns = !!user.organizer && user.organizer.id === event.organizerId;
  if (!owns && !(opts.allowAdmin && user.role === "ADMIN")) throw forbidden();
  return event;
}
