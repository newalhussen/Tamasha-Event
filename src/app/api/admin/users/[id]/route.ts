import { z } from "zod";
import { ApiError, notFound, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const admin = await requireUser(["ADMIN"]);
  const { status } = await parseBody(req, schema);
  if (id === admin.id) throw new ApiError(409, "You can't suspend your own account.", "SELF");
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user");
  if (user.role === "ADMIN") throw new ApiError(403, "Admin accounts can't be suspended here.", "ADMIN_PROTECTED");
  await db.user.update({ where: { id }, data: { status } });
  await db.moderationLog.create({ data: { adminId: admin.id, action: `USER_${status}`, note: user.email } });
  return { ok: true };
});
