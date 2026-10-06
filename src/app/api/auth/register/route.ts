import { parseBody, route } from "@/lib/api";
import { createAccount } from "@/lib/accounts";
import { createSession, homeFor } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import type { Role } from "@/lib/enums";

export const POST = route(async (req) => {
  const input = await parseBody(req, registerSchema);
  const user = await createAccount(input);
  await createSession(user.id, user.role as Role);
  return { ok: true, role: user.role, home: homeFor(user.role as Role) };
});
