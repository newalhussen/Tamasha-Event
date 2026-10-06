import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketEditor } from "@/components/organizer/ticket-editor";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { includeRels, summarize, ticketCounts } from "@/lib/events";

export const metadata: Metadata = { title: "Tickets" };

export default async function EventTickets({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/tickets`);
  const event = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, include: includeRels });
  if (!event) notFound();
  const s = summarize(event, await ticketCounts([id]));
  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
      <div>
        <h2 className="h-display text-[clamp(28px,4vw,40px)]">Tickets</h2>
        <p className="mt-1.5 text-[17px] text-muted">You can add or change ticket types any time, even while on sale. Tickets already sold keep the price they were bought at.</p>
      </div>
      {event.status === "CANCELLED" ? (
        <p className="rounded-xl bg-bg px-4 py-3 text-muted">This event is cancelled, so tickets can't be changed.</p>
      ) : (
        <TicketEditor
          eventId={id}
          capacity={event.capacity}
          types={s.types.map((t) => ({
            id: t.id,
            name: t.name,
            kind: t.kind,
            price: t.price,
            quantity: t.quantity,
            sold: t.sold,
            held: t.held,
            description: t.description,
            perOrderMax: t.perOrderMax,
            saleStart: t.saleStart,
            saleEnd: t.saleEnd,
          }))}
        />
      )}
    </main>
  );
}
