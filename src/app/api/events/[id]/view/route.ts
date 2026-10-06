import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { sanitizeSource } from "@/lib/orders";
import { z } from "zod";
import { parseBody } from "@/lib/api";

/** Page-view beacon used by organizer analytics. Fire-and-forget from the event page. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { source } = await parseBody(req, z.object({ source: z.string().max(30).optional() }));
  const event = await db.event.findFirst({ where: { id, status: "PUBLISHED" }, select: { id: true } });
  if (event) await db.eventView.create({ data: { eventId: id, source: sanitizeSource(source) } });
  return { ok: true };
});
