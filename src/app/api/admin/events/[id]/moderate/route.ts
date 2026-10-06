import { parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { moderateEvent } from "@/lib/moderation";
import { moderationSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const admin = await requireUser(["ADMIN"]);
  const { action, note } = await parseBody(req, moderationSchema);
  await moderateEvent({ eventId: id, adminId: admin.id, action, note });
  return { ok: true };
});
