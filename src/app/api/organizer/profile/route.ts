import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your organization name.").max(80),
  description: z.string().trim().max(400).optional(),
  payoutBank: z.string().trim().max(60).optional(),
  payoutAccount: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Account numbers are 6 to 20 digits.")
    .optional()
    .or(z.literal("")),
});

/** Update organizer profile and payout details. Changing the payout account resets verification. */
export const PATCH = route(async (req) => {
  const user = await requireOrganizer();
  const input = await parseBody(req, schema);
  const current = await db.organizer.findUniqueOrThrow({ where: { id: user.organizer.id } });
  const payoutChanged =
    (input.payoutAccount ?? current.payoutAccount ?? "") !== (current.payoutAccount ?? "") ||
    (input.payoutBank ?? current.payoutBank ?? "") !== (current.payoutBank ?? "");
  await db.organizer.update({
    where: { id: current.id },
    data: {
      name: input.name,
      description: input.description ?? current.description,
      payoutBank: input.payoutBank ?? current.payoutBank,
      payoutAccount: input.payoutAccount || current.payoutAccount,
      ...(payoutChanged ? { payoutVerified: false } : {}),
    },
  });
  return { ok: true, payoutChanged };
});
