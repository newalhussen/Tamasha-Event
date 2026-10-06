import { parseBody, route } from "@/lib/api";
import { requireOrganizer } from "@/lib/auth";
import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/events";
import { slugify } from "@/lib/format";
import { eventBasicsSchema } from "@/lib/validation";

/** Step 1 of the wizard creates the draft; later steps PATCH it. */
export const POST = route(async (req) => {
  const user = await requireOrganizer();
  const input = await parseBody(req, eventBasicsSchema);
  const slug = await uniqueSlug(slugify(input.title));
  const startsAt = new Date(Date.now() + 30 * 86_400_000);
  startsAt.setUTCHours(16, 0, 0, 0); // 7:00 PM Addis placeholder, replaced in "When and where"
  const event = await db.event.create({
    data: {
      organizerId: user.organizer.id,
      slug,
      title: input.title,
      category: input.category,
      summary: input.summary ?? "",
      startsAt,
      capacity: 0,
      status: "DRAFT",
    },
  });
  return { id: event.id };
});
