import "server-only";
import { db } from "./db";
import { ApiError, notFound } from "./api";
import { cancelEventAndRefund } from "./orders";

export type ModerationAction = "APPROVE" | "REJECT" | "ASK_CHANGES" | "SUSPEND_ORGANIZER" | "UNPUBLISH" | "CANCEL";

/** Apply an admin decision to an event and record who made it. */
export async function moderateEvent(input: { eventId: string; adminId: string; action: ModerationAction; note?: string }) {
  const event = await db.event.findUnique({ where: { id: input.eventId }, include: { organizer: true } });
  if (!event) throw notFound("That event");
  const note = input.note?.trim() ?? "";
  if (["REJECT", "ASK_CHANGES", "SUSPEND_ORGANIZER"].includes(input.action) && note.length < 5) {
    throw new ApiError(422, "Add a short reason. The organizer will see it.", "NOTE_REQUIRED", { note: "Add a short reason." });
  }

  switch (input.action) {
    case "APPROVE":
      await db.event.update({
        where: { id: event.id },
        data: { status: "PUBLISHED", flag: "", reviewReason: "", submittedAt: null, publishedAt: event.publishedAt ?? new Date() },
      });
      await db.report.updateMany({ where: { eventId: event.id, status: "OPEN" }, data: { status: "DISMISSED", resolvedAt: new Date() } });
      break;
    case "REJECT":
      await db.event.update({ where: { id: event.id }, data: { status: "REJECTED", flag: "", reviewReason: note } });
      await db.report.updateMany({ where: { eventId: event.id, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
      break;
    case "ASK_CHANGES":
      await db.event.update({ where: { id: event.id }, data: { status: "DRAFT", flag: "", reviewReason: note } });
      break;
    case "UNPUBLISH":
      await db.event.update({ where: { id: event.id }, data: { status: "DRAFT", flag: "", reviewReason: note || "Taken down by Tamasha." } });
      break;
    case "CANCEL":
      await cancelEventAndRefund(event.id);
      break;
    case "SUSPEND_ORGANIZER":
      await db.organizer.update({ where: { id: event.organizerId }, data: { status: "SUSPENDED", verified: false, verificationNote: note } });
      await db.event.update({ where: { id: event.id }, data: { status: "REJECTED", flag: "", reviewReason: note } });
      break;
  }
  await db.moderationLog.create({
    data: { adminId: input.adminId, eventId: event.id, organizerId: event.organizerId, action: input.action, note },
  });
}
