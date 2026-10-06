import type { Metadata } from "next";
import Link from "next/link";
import { Lifecycle } from "@/components/organizer/lifecycle";
import { requirePage } from "@/lib/auth";
import { dateShort } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import type { EventDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Event settings" };

export default async function EventSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/settings`);
  const { event, soldCount: sold } = await apiGet<EventDetail>(`/organizer/events/${id}`);
  const refundNone = event.refundUntil && new Date(event.refundUntil).getTime() < new Date(event.createdAt).getTime();
  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-9 px-4 pb-[72px] pt-8 sm:px-8">
      <section className="flex flex-col">
        <h2 className="h2 border-b-2 border-ink pb-2.5">Event details</h2>
        {[
          ["Public link", `/events/${event.slug}`],
          ["Refund policy", event.refundUntil ? (refundNone ? "No refunds" : `Full refund until ${dateShort(event.refundUntil)}`) : "Not chosen yet"],
          ["Sales close", event.salesEnd ? dateShort(event.salesEnd) : "When the event starts"],
          ["Status", event.status.replace("_", " ").toLowerCase()],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-3 border-b border-line2 py-3.5">
            <span className="text-muted">{k}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
        <div className="pt-3">
          <Link href={`/organizer/events/${id}/edit?step=page`} className="font-semibold">
            Edit page, artwork and refund policy
          </Link>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="h2 border-b-2 border-ink pb-2.5">Danger zone</h2>
        <Lifecycle eventId={id} status={event.status} ready soldCount={sold} verified={user.organizer!.verified} show="danger" />
      </section>
    </main>
  );
}
