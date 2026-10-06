import { notFound, parseBody, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, reportSchema);
  const user = await getCurrentUser();
  const event = await db.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) throw notFound("That event");
  await db.report.create({
    data: { eventId: id, reporterId: user?.id, reason: input.reason, details: input.details ?? "" },
  });
  return { ok: true };
});
