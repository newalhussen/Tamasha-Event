import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await db.savedEvent.upsert({
    where: { userId_eventId: { userId: user.id, eventId: id } },
    create: { userId: user.id, eventId: id },
    update: {},
  });
  return { saved: true };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  await db.savedEvent.deleteMany({ where: { userId: user.id, eventId: id } });
  return { saved: false };
});
