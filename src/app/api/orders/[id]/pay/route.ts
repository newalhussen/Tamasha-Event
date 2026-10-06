import { ApiError, parseBody, route } from "@/lib/api";
import { createAccount } from "@/lib/accounts";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { payOrder } from "@/lib/orders";
import { normalizePhone } from "@/lib/phone";
import { payOrderSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const input = await parseBody(req, payOrderSchema);

  let user = await getCurrentUser();
  if (!user) {
    // Inline account creation: checkout stays one page, tickets live in the new account.
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, "You already have an account with this email. Sign in to continue.", "EMAIL_TAKEN", {
        email: "You already have an account with this email.",
      });
    }
    if (!input.password || input.password.length < 8) {
      throw new ApiError(422, "Create a password of at least 8 characters to keep your tickets.", "PASSWORD", {
        password: "Use at least 8 characters.",
      });
    }
    const created = await createAccount({ name: input.name, email: input.email, phone: input.phone, password: input.password });
    await createSession(created.id, "ATTENDEE");
    user = { id: created.id } as NonNullable<typeof user>;
  } else if (user.role !== "ATTENDEE") {
    throw new ApiError(403, "Organizer and admin accounts can't buy tickets. Use an attendee account.", "STAFF_ACCOUNT");
  }

  const payPhone = input.payPhone ? normalizePhone(input.payPhone) : undefined;
  if (input.payPhone && !payPhone) {
    throw new ApiError(422, "Use an Ethiopian mobile number, like 0911 234 567.", "PAY_PHONE", { payPhone: "Use an Ethiopian mobile number." });
  }

  return payOrder({
    orderId: id,
    userId: user.id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    holders: input.holders,
    method: input.method,
    payPhone: payPhone ?? undefined,
  });
});
