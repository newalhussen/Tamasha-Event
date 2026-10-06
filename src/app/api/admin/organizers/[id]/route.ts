import { z } from "zod";
import { ApiError, notFound, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  action: z.enum(["VERIFY", "SUSPEND", "REINSTATE", "REQUEST_DETAILS", "VERIFY_PAYOUT"]),
  note: z.string().trim().max(400).optional(),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const admin = await requireUser(["ADMIN"]);
  const { action, note } = await parseBody(req, schema);
  const org = await db.organizer.findUnique({ where: { id } });
  if (!org) throw notFound("That organizer");

  switch (action) {
    case "VERIFY":
      await db.organizer.update({ where: { id }, data: { verified: true, status: "VERIFIED", verificationNote: "" } });
      break;
    case "VERIFY_PAYOUT":
      if (!org.payoutAccount) throw new ApiError(422, "This organizer hasn't added a payout account yet.", "NO_PAYOUT");
      await db.organizer.update({ where: { id }, data: { payoutVerified: true } });
      break;
    case "SUSPEND":
      await db.organizer.update({ where: { id }, data: { status: "SUSPENDED", verified: false, verificationNote: note ?? "" } });
      break;
    case "REINSTATE":
      await db.organizer.update({ where: { id }, data: { status: org.verified ? "VERIFIED" : "PENDING", verificationNote: "" } });
      break;
    case "REQUEST_DETAILS":
      if (!note || note.length < 5) throw new ApiError(422, "Say what details you need.", "NOTE_REQUIRED", { note: "Say what's missing." });
      await db.organizer.update({ where: { id }, data: { verificationNote: note } });
      break;
  }
  await db.moderationLog.create({ data: { adminId: admin.id, organizerId: id, action: `ORG_${action}`, note: note ?? "" } });
  return { ok: true };
});
