import { z } from "zod";
import { ApiError, notFound, parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { db } from "@/lib/db";
import { refundOrder } from "@/lib/orders";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const { decision } = await parseBody(req, z.object({ decision: z.enum(["APPROVE", "DECLINE"]) }));
  const request = await db.refundRequest.findUnique({ where: { id }, include: { order: { include: { event: true } } } });
  if (!request || request.order.event.organizerId !== user.organizer.id) throw notFound("That refund request");
  if (request.status !== "PENDING") throw new ApiError(409, "This request was already decided.");
  if (decision === "APPROVE") await refundOrder(request.orderId);
  else await db.refundRequest.update({ where: { id }, data: { status: "DECLINED", decidedAt: new Date() } });
  return { ok: true };
});
