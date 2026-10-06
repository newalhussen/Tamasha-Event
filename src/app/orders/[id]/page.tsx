import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { QrSvg } from "@/components/tickets/qr";
import { PrintButton, SendToGuest } from "@/components/tickets/ticket-actions";
import { Icon } from "@/components/ui/icon";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYMENT_LABEL } from "@/lib/enums";
import { birr, dateShort, timeLabel, where } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function OrderConfirmation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ATTENDEE"], `/orders/${id}`);
  const order = await db.order.findUnique({
    where: { id },
    include: { event: true, tickets: { include: { ticketType: true }, orderBy: { seq: "asc" } } },
  });
  if (!order || order.userId !== user.id || order.status === "PENDING" || order.status === "EXPIRED") notFound();

  const e = order.event;
  const first = user.name.split(" ")[0];
  const n = order.tickets.length;
  const free = order.total === 0;
  const refunded = order.status === "REFUNDED";
  const unnamed = order.tickets.find((t) => t.seq > 1 && !t.holderName);

  return (
    <div className="min-h-screen bg-bg text-base">
      <SiteHeader user={user} maxWidth={1120} />
      <main className="mx-auto flex max-w-[1120px] flex-col gap-11 px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
        <section className="flex max-w-[760px] flex-col gap-4">
          <div className={`flex items-center gap-2.5 font-bold ${refunded ? "text-danger" : "text-primary-dark"}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${refunded ? "bg-danger" : "bg-primary"}`}>
              <Icon name={refunded ? "x" : "check"} size={18} stroke={3} className="text-white" />
            </span>
            {refunded ? "Refunded" : free ? "Registration confirmed" : `Payment received · ${birr(order.total)}`}
          </div>
          <h1 className="h-display text-[clamp(44px,8vw,72px)] leading-[0.96] tracking-[-0.045em]">{refunded ? "This order was refunded." : `You're going, ${first}.`}</h1>
          <p className="m-0 text-xl text-muted [text-wrap:pretty] sm:text-[19px]">
            {n === 1 ? "One ticket" : `${n} tickets`} for <strong className="text-ink">{e.title}</strong> {refunded ? "no longer work." : <>are saved to your account ({user.email}){user.phone ? ` and linked to ${formatPhone(user.phone)}` : ""}.</>}
          </p>
          {!refunded && (
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={`/tickets/${order.tickets[0].code}`} className="btn btn-primary btn-lg">
                Open my tickets
              </Link>
              <a href={`/api/events/${e.id}/calendar`} className="btn btn-outline h-14 rounded-[14px] px-[22px] text-base">
                Add to calendar
              </a>
              {unnamed && <SendToGuest ticketId={unnamed.id} label={`Send ticket ${unnamed.seq} to a guest`} className="btn btn-outline h-14 rounded-[14px] px-[22px] text-base" />}
            </div>
          )}
        </section>

        {!refunded && (
          <section className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))" }}>
            {order.tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.code}`}
                className="relative flex rounded-[20px] bg-white text-ink no-underline shadow-[0_10px_28px_rgba(21,18,31,0.08)] hover:text-ink max-sm:flex-col"
              >
                <div className="w-3.5 flex-none rounded-l-[20px] bg-primary max-sm:h-3.5 max-sm:w-auto max-sm:rounded-l-none max-sm:rounded-t-[20px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-3.5 px-5 py-[22px]">
                  <div>
                    <div className="mono text-xs text-muted">
                      TICKET {t.seq} OF {n} · {t.ticketType.name.toUpperCase()}
                    </div>
                    <div className="mt-1 font-display text-[22px] font-bold leading-[1.15] tracking-[-0.02em]">{e.title}</div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <div>
                      <div className="text-muted">Date</div>
                      <div className="font-bold">
                        {dateShort(e.startsAt)} · {timeLabel(e.startsAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted">Name</div>
                      <div className={`font-bold ${t.holderName ? "" : "text-rose-ink"}`}>{t.holderName || "Guest not named yet"}</div>
                    </div>
                  </div>
                </div>
                <div className="relative my-3.5 w-0 border-l-2 border-dashed border-soft max-sm:mx-5 max-sm:my-0 max-sm:h-0 max-sm:w-auto max-sm:border-l-0 max-sm:border-t-2">
                  <span className="absolute -left-[11px] -top-6 h-5 w-5 rounded-full bg-bg max-sm:-top-[11px] max-sm:left-auto max-sm:-left-8" />
                  <span className="absolute -bottom-6 -left-[11px] h-5 w-5 rounded-full bg-bg max-sm:-bottom-[11px] max-sm:-right-8 max-sm:left-auto" />
                </div>
                <div className="flex flex-none flex-col items-center justify-center gap-2 p-5">
                  <QrSvg value={t.code} label={`QR code for ticket ${t.code}`} className="h-[104px] w-[104px]" />
                  <div className="mono text-xs">{t.code}</div>
                </div>
              </Link>
            ))}
          </section>
        )}

        <section className="flex flex-wrap gap-12">
          <div className="flex min-w-0 flex-[2_1_480px] flex-col">
            <h2 className="m-0 mb-3 font-display text-2xl font-bold tracking-[-0.02em]">On the night</h2>
            {[
              [e.gatesAt ? `Gates open at ${timeLabel(e.gatesAt)}.` : "Arrive a little early.", `${e.title} starts at ${timeLabel(e.startsAt)} at ${where(e.venueName, e.venueAddress)}.`],
              ["Show your QR code at the gate.", "Open the ticket on your phone before you leave home so it's ready."],
              e.ageLimit > 0 ? ["Bring your ID.", `This event is ${e.ageLimit} and over.`] : ["Bring your phone.", "Tickets are checked by QR code at the entrance."],
            ].map(([strong, rest], i, arr) => (
              <div key={i} className={`flex gap-4 border-t border-line2 py-3.5 ${i === arr.length - 1 ? "border-b" : ""}`}>
                <span className="mono w-7 flex-none text-primary">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{strong}</strong> {rest}
                </div>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col">
            <h2 className="m-0 mb-3 font-display text-2xl font-bold tracking-[-0.02em]">Receipt</h2>
            <div className="flex justify-between gap-3 border-t border-line2 py-3.5">
              <span className="text-muted">Order</span>
              <span className="mono">#{order.code}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-line2 py-3.5">
              <span className="text-muted">Paid with</span>
              <span className="font-semibold">{order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : "—"}</span>
            </div>
            <div className="flex justify-between gap-3 border-y border-line2 py-3.5">
              <span className="text-muted">Refundable until</span>
              <span className="font-semibold">{free ? "Any time before the event" : e.refundUntil ? dateShort(e.refundUntil) : "—"}</span>
            </div>
            <PrintButton label="Print receipt" className="btn-link btn self-start" />
          </div>
        </section>
      </main>
    </div>
  );
}
