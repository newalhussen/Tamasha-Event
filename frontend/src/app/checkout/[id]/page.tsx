import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/events/checkout-form";
import { CoverArt } from "@/components/events/cover-art";
import { HoldTimer } from "@/components/events/hold-timer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import type { EventRecord, OrderRecord } from "@/lib/types";
import { birr, dateShort, timeLabel, where } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

type CheckoutOrder = OrderRecord & {
  event: EventRecord;
  tickets: { seq: number; price: number; ticketTypeId: string; ticketType: { name: string; kind: string } }[];
};

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user && user.role !== "ATTENDEE") redirect("/");
  const { order } = await apiGet<{ order: CheckoutOrder }>(`/orders/${id}/checkout`);
  if (order.status === "PAID") redirect(`/orders/${order.id}`);

  const e = order.event;
  const expired = order.status !== "PENDING" || new Date(order.holdExpiresAt) <= new Date();
  // Group tickets into "2 × General Admission" lines.
  const lines = new Map<string, { name: string; count: number; amount: number; typeId: string; unit: number }>();
  for (const t of order.tickets) {
    const cur = lines.get(t.ticketTypeId) ?? { name: t.ticketType.name, count: 0, amount: 0, typeId: t.ticketTypeId, unit: t.price };
    cur.count += 1;
    cur.amount += t.price;
    lines.set(t.ticketTypeId, cur);
  }
  const lineList = [...lines.values()];
  const kinds = new Map(order.tickets.map((t) => [t.ticketTypeId, t.ticketType.kind]));
  const retryItems = lineList.map((l) => ({ ticketTypeId: l.typeId, quantity: l.count, ...(kinds.get(l.typeId) === "PWYW" ? { amount: l.unit } : {}) }));

  return (
    <div className="min-h-screen bg-bg text-base">
      <SiteHeader user={user} variant="checkout" maxWidth={1120}>
        {!expired && <HoldTimer expiresAt={order.holdExpiresAt} />}
      </SiteHeader>
      <main className="mx-auto flex max-w-[1120px] flex-col gap-7 px-4 pb-20 pt-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <Link href={`/events/${e.slug}`} className="text-[15px] font-semibold no-underline">
            ← Back to event
          </Link>
          <h1 className="h-display text-[clamp(34px,5vw,44px)] leading-[1.05]">Checkout</h1>
        </div>

        <div className="flex flex-wrap items-start gap-12">
          <CheckoutForm
            orderId={order.id}
            eventId={e.id}
            eventTitle={e.title}
            total={order.total}
            holdExpiresAt={order.holdExpiresAt}
            initialPayError={order.paymentError}
            refundLabel={e.refundUntil && order.total > 0 ? `Full refund available until ${dateShort(e.refundUntil)}.` : null}
            tickets={order.tickets.map((t) => ({ seq: t.seq, typeName: t.ticketType.name }))}
            retryItems={retryItems}
            user={user ? { name: user.name, email: user.email, phone: formatPhone(user.phone) } : null}
            next={`/checkout/${order.id}`}
          />

          <aside aria-label="Order summary" className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-[20px] border border-line bg-white">
            <div className="relative h-[120px] overflow-hidden bg-primary">
              <CoverArt preset={e.coverPreset} text={e.coverText || undefined} textSize={9} />
            </div>
            <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
              <div>
                <div className="font-display text-xl font-bold leading-tight tracking-[-0.02em]">{e.title}</div>
                <div className="mt-1 text-[15px] text-muted">
                  {dateShort(e.startsAt)} · {timeLabel(e.startsAt)}
                  <br />
                  {where(e.venueName, e.venueAddress)}
                </div>
              </div>
              {lineList.map((l) => (
                <div key={l.typeId} className="flex justify-between gap-3 border-t border-dashed border-field pt-4">
                  <div>
                    <div className="font-semibold">
                      {l.count} × {l.name}
                    </div>
                    <Link href={`/events/${e.slug}`} className="text-sm font-semibold">
                      Change
                    </Link>
                  </div>
                  <div className="font-semibold">{l.amount === 0 ? "Free" : birr(l.amount)}</div>
                </div>
              ))}
              <div className="flex justify-between gap-3 text-muted">
                <span>Booking fees</span>
                <span>Included</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t-2 border-ink pt-4">
                <span className="font-bold">Total</span>
                <span className="font-display text-[28px] font-bold tracking-[-0.02em]">{order.total === 0 ? "Free" : birr(order.total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
