import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Scanner } from "@/components/organizer/scanner";
import { requirePage } from "@/lib/auth";
import { checkInProgress } from "@/lib/checkin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Door scanner" };
export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/scan`);
  const event = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, select: { id: true, title: true, status: true } });
  if (!event) notFound();
  const p = await checkInProgress(id);
  return (
    <div className="min-h-screen bg-night">
      <Scanner eventId={id} eventTitle={event.title} initial={{ total: p.total, checked: p.checked }} />
    </div>
  );
}
