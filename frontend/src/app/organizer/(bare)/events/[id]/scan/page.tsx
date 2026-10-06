import type { Metadata } from "next";
import { Scanner } from "@/components/organizer/scanner";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Door scanner" };
export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePage(["ORGANIZER"], `/organizer/events/${id}/scan`);
  const { title, progress } = await apiGet<{ title: string; progress: { total: number; checked: number } }>(`/organizer/events/${id}/checkin`);
  return (
    <div className="min-h-screen bg-night">
      <Scanner eventId={id} eventTitle={title} initial={{ total: progress.total, checked: progress.checked }} />
    </div>
  );
}
