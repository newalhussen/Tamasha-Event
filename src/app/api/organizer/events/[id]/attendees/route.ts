import { route } from "@/lib/api";
import { getManagedEvent } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { listAttendees, type AttendeeStatusFilter } from "@/lib/attendees";
import { checkInProgress } from "@/lib/checkin";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") as AttendeeStatusFilter) || "all";
  const [list, progress] = await Promise.all([
    listAttendees({
      eventId: id,
      q: sp.get("q") ?? undefined,
      status: ["all", "in", "not"].includes(status) ? status : "all",
      typeId: sp.get("type") || undefined,
      page: Number(sp.get("page") ?? 1) || 1,
    }),
    checkInProgress(id),
  ]);
  return { ...list, progress };
});
