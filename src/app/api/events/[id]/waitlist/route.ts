import { notFound, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { waitlistSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { phone } = await parseBody(req, waitlistSchema);
  const event = await db.event.findFirst({ where: { id, status: "PUBLISHED" }, select: { id: true } });
  if (!event) throw notFound("That event");
  await db.waitlistEntry.upsert({
    where: { eventId_phone: { eventId: id, phone } },
    create: { eventId: id, phone },
    update: {},
  });
  const position = await db.waitlistEntry.count({ where: { eventId: id } });
  return { ok: true, position, ahead: Math.max(0, position - 1) };
});
