import { parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, profileSchema);
  await db.user.update({
    where: { id: user.id },
    data: {
      name: input.name,
      phone: input.phone ?? null,
      ...(input.city ? { city: input.city } : {}),
      ...(input.prefs ? { prefs: JSON.stringify(input.prefs) } : {}),
    },
  });
  return { ok: true };
});
