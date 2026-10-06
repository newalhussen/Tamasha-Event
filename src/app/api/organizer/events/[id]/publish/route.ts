import { route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { getManagedEvent } from "@/lib/access";
import { publishEvent } from "@/lib/publishing";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  const event = await publishEvent(id);
  return { ok: true, status: event.status, slug: event.slug };
});
