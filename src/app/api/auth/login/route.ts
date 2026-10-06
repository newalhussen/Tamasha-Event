import { ApiError, parseBody, route } from "@/lib/api";
import { createSession, homeFor, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import type { Role } from "@/lib/enums";

// Same message for unknown email and wrong password so accounts can't be enumerated.
const BAD = "That email and password don't match. Check them and try again.";

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) throw new ApiError(401, BAD, "BAD_CREDENTIALS");
  if (user.status !== "ACTIVE") throw new ApiError(403, "This account is suspended. Contact support.", "SUSPENDED");
  await createSession(user.id, user.role as Role);
  return { ok: true, role: user.role, home: homeFor(user.role as Role) };
});
