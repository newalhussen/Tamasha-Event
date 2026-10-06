import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttendeesBoard } from "@/components/organizer/attendees-board";
import { requirePage } from "@/lib/auth";
import { listAttendees } from "@/lib/attendees";
import { checkInProgress } from "@/lib/checkin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Attendees and check-in" };

export default async function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/attendees`);
  const event = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, select: { id: true } });
  if (!event) notFound();
  const [list, progress, types] = await Promise.all([
    listAttendees({ eventId: id }),
    checkInProgress(id),
    db.ticketType.findMany({ where: { eventId: id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-7 px-4 pb-[72px] pt-7 sm:px-8">
      <AttendeesBoard eventId={id} initial={{ ...list, progress }} types={types} />
    </main>
  );
}
