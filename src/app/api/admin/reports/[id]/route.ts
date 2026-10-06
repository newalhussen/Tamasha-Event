import { z } from "zod";
import { notFound, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]) });

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const admin = await requireUser(["ADMIN"]);
  const { status } = await parseBody(req, schema);
  const report = await db.report.findUnique({ where: { id } });
  if (!report) throw notFound("That report");
  await db.report.update({ where: { id }, data: { status, resolvedAt: new Date() } });
  await db.moderationLog.create({ data: { adminId: admin.id, eventId: report.eventId, action: `REPORT_${status}`, note: report.reason } });
  return { ok: true };
});
