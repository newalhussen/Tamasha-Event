import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { getManagedEvent } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

const schema = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(120),
  body: z.string().trim().min(5, "Write a short message.").max(1000),
});

/** Message everyone holding a valid ticket. Delivery goes through lib/notify (log-only until a provider is configured). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  const { subject, body } = await parseBody(req, schema);
  const orders = await db.order.findMany({
    where: { eventId: id, status: "PAID", tickets: { some: { status: { in: ["VALID", "CHECKED_IN"] } } } },
    select: { email: true },
    distinct: ["email"],
  });
  await Promise.all(
    orders.map((o) => notify({ to: o.email, channel: "email", subject: `${event.title}: ${subject}`, body })),
  );
  return { ok: true, recipients: orders.length };
});
