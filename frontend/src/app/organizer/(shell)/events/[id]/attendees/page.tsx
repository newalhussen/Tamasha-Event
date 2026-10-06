import type { Metadata } from "next";
import { AttendeesBoard, type Data } from "@/components/organizer/attendees-board";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Attendees and check-in" };

export default async function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/attendees`);
  const { types, ...initial } = await apiGet<Data & { types: { id: string; name: string }[] }>(`/organizer/events/${id}/attendees`);
  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-7 px-4 pb-[72px] pt-7 sm:px-8">
      <AttendeesBoard eventId={id} initial={initial} types={types} />
    </main>
  );
}
