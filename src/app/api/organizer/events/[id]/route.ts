import { z } from "zod";
import { ApiError, parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/events";
import { slugify } from "@/lib/format";
import { eventBasicsSchema, eventPageSchema, eventWhenWhereSchema } from "@/lib/validation";

const sectionSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("basics"), data: eventBasicsSchema }),
  z.object({ section: z.literal("where"), data: eventWhenWhereSchema }),
  z.object({ section: z.literal("page"), data: eventPageSchema }),
]);

/** Save one wizard section. Material changes to a live event are tracked for buyers and moderators. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  if (event.status === "CANCELLED") throw new ApiError(409, "A cancelled event can't be edited.");
  const input = await parseBody(req, sectionSchema);
  const live = event.status === "PUBLISHED";
  const soldTickets = live ? await db.ticket.count({ where: { eventId: id, status: { in: ["VALID", "CHECKED_IN"] } } }) : 0;

  if (input.section === "basics") {
    const d = input.data;
    await db.event.update({
      where: { id },
      data: {
        title: d.title,
        category: d.category,
        summary: d.summary ?? "",
        ...(d.title !== event.title && !live ? { slug: await uniqueSlug(slugify(d.title), id) } : {}),
      },
    });
  } else if (input.section === "where") {
    const d = input.data;
    const sold = await db.ticket.count({ where: { eventId: id, status: { in: ["VALID", "CHECKED_IN", "HELD"] } } });
    if (d.capacity < sold) {
      throw new ApiError(422, `${sold} tickets are already sold or held. Capacity can't be lower.`, "CAPACITY", {
        capacity: `At least ${sold}, the tickets already sold.`,
      });
    }
    const startsAt = new Date(d.startsAt);
    const data: Record<string, unknown> = {
      startsAt,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      gatesAt: d.gatesAt ? new Date(d.gatesAt) : null,
      venueName: d.venueName,
      venueAddress: d.venueAddress ?? "",
      city: d.city,
      ageLimit: d.ageLimit,
      capacity: d.capacity,
    };
    if (live && soldTickets > 0) {
      if (startsAt.getTime() !== event.startsAt.getTime()) {
        data.previousStartsAt = event.previousStartsAt ?? event.startsAt;
        await db.ticket.updateMany({ where: { eventId: id, status: "VALID" }, data: { rescheduleAck: false } });
      }
      if (d.venueName.trim().toLowerCase() !== event.venueName.trim().toLowerCase()) {
        data.flag = `Venue changed after ${soldTickets} sales`;
        data.submittedAt = new Date();
      }
    }
    await db.event.update({ where: { id }, data });
  } else {
    const d = input.data;
    await db.event.update({
      where: { id },
      data: {
        description: d.description,
        coverPreset: d.coverPreset,
        coverText: d.coverText ?? "",
        lineup: JSON.stringify(d.lineup),
        info: JSON.stringify(d.info),
        refundUntil: d.refundUntil ? new Date(d.refundUntil) : null,
        salesEnd: d.salesEnd ? new Date(d.salesEnd) : null,
      },
    });
  }
  return { ok: true, savedAt: new Date().toISOString() };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  if (event.status !== "DRAFT") throw new ApiError(409, "Only drafts can be deleted. Cancel a published event instead.");
  await db.event.delete({ where: { id } });
  return { ok: true };
});
