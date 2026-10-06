import type { Metadata } from "next";
import Link from "next/link";
import { CoverArt } from "@/components/events/cover-art";
import { SiteHeader } from "@/components/layout/site-header";
import { ProfilePanel } from "@/components/tickets/profile-panel";
import { AckReschedule, RefundButton, SendToGuest } from "@/components/tickets/ticket-actions";
import { Icon } from "@/components/ui/icon";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventPhase } from "@/lib/events";
import { birr, dateShort, daysUntil, relativeDays, timeLabel, where } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "My tickets" };
export const dynamic = "force-dynamic";

type Tab = "upcoming" | "past" | "refunded";

export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const user = await requirePage(["ATTENDEE", "ORGANIZER", "ADMIN"], "/tickets");
  const tab: Tab = rawTab === "past" || rawTab === "refunded" ? rawTab : "upcoming";
  const now = new Date();

  const orders = await db.order.findMany({
    where: { userId: user.id, status: { in: ["PAID", "REFUNDED"] } },
    include: { event: true, tickets: { include: { ticketType: true }, orderBy: { seq: "asc" } }, refundRequest: true },
    orderBy: { event: { startsAt: "asc" } },
  });

  const upcoming = orders.filter((o) => o.status === "PAID" && eventPhase(o.event, now) !== "ENDED");
  const past = orders.filter((o) => o.status === "PAID" && eventPhase(o.event, now) === "ENDED").reverse();
  const refunded = orders.filter((o) => o.status === "REFUNDED").reverse();
  const cancelledNotices = refunded.filter((o) => o.event.status === "CANCELLED" && now.getTime() - (o.refundedAt ?? o.createdAt).getTime() < 21 * 86_400_000);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "past", label: "Past", count: past.length },
    { key: "refunded", label: "Refunded", count: refunded.length },
  ];

  return (
    <div className="min-h-screen bg-bg text-base">
      <SiteHeader user={user} current="tickets" />
      <main className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-14 px-4 pb-20 pt-10 sm:px-8">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-6">
          <h1 className="h-display text-[clamp(36px,5vw,48px)]">My tickets</h1>

          <div role="tablist" aria-label="Ticket status" className="flex flex-wrap gap-1 border-b border-line2">
            {tabs.map((t) => (
              <Link
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                href={t.key === "upcoming" ? "/tickets" : `/tickets?tab=${t.key}`}
                className={`flex h-12 items-center px-4 no-underline ${tab === t.key ? "font-bold text-ink shadow-[inset_0_-3px_0_#15121F]" : "font-semibold text-muted"}`}
              >
                {t.label} <span className={`ml-1.5 font-medium ${tab === t.key ? "text-muted" : ""}`}>{t.count}</span>
              </Link>
            ))}
          </div>

          {tab === "upcoming" && cancelledNotices.map((o) => (
            <div key={o.id} role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-line bg-white px-5 py-4">
              <span className="badge badge-danger">Event cancelled</span>
              <div className="min-w-[260px] flex-[1_1_320px]">
                <strong>{o.event.title}</strong> was cancelled by the organizer. {o.total > 0 ? `${birr(o.total)} was refunded to your original payment method` : "Your registration was cancelled"}
                {o.refundedAt ? ` on ${dateShort(o.refundedAt)}` : ""}.
              </div>
              <Link href="/tickets?tab=refunded" className="font-semibold">
                View refund
              </Link>
            </div>
          ))}

          {tab === "upcoming" && (
            <>
              {upcoming.length === 0 && (
                <div className="flex flex-col gap-3 rounded-[20px] border border-dashed border-field bg-white px-6 py-8">
                  <div className="font-display text-2xl font-bold">No upcoming tickets</div>
                  <div className="text-muted">When you buy tickets they'll show up here with a QR code for the gate.</div>
                  <Link href="/" className="btn btn-dark btn-md self-start">
                    Browse events
                  </Link>
                </div>
              )}
              {upcoming.map((o) => {
                const e = o.event;
                const types = [...new Set(o.tickets.map((t) => t.ticketType.name))];
                const unnamed = o.tickets.find((t) => t.seq > 1 && !t.holderName);
                const free = o.total === 0;
                const live = eventPhase(e, now) === "LIVE";
                const needsAck = !!e.previousStartsAt && o.tickets.some((t) => !t.rescheduleAck);
                const pendingRefund = o.refundRequest?.status === "PENDING";
                return (
                  <div key={o.id} className="flex flex-col gap-4">
                    {needsAck && (
                      <div className="flex flex-col gap-3.5 rounded-[20px] border-2 border-ink bg-white p-6">
                        <span className="badge badge-warn self-start">New date</span>
                        <div className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">
                          {e.title} moved to {dateShort(e.startsAt)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-muted">
                          <span className="line-through">
                            {dateShort(e.previousStartsAt!)} · {timeLabel(e.previousStartsAt!)}
                          </span>
                          <span aria-hidden="true">→</span>
                          <strong className="text-ink">
                            {dateShort(e.startsAt)} · {timeLabel(e.startsAt)}
                          </strong>
                        </div>
                        <div>Your ticket works for the new date. Nothing to do if you can still come.</div>
                        <AckReschedule ticketId={o.tickets[0].id} orderId={o.id} refundLabel={`Refund available until ${dateShort(new Date(e.startsAt.getTime() - 86_400_000))}`} />
                      </div>
                    )}
                    <article className="flex flex-wrap rounded-[20px] bg-white shadow-[0_10px_28px_rgba(21,18,31,0.07)]">
                      <div className="relative min-h-[150px] flex-[0_0_150px] overflow-hidden rounded-l-[20px] bg-primary max-sm:flex-[1_0_100%] max-sm:rounded-l-none max-sm:rounded-t-[20px]">
                        <CoverArt preset={e.coverPreset} text={e.coverText || undefined} textSize={13} />
                      </div>
                      <div className="flex min-w-[260px] flex-[1_1_320px] flex-col gap-2.5 px-6 py-[22px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-tint">{live ? "Happening now" : relativeDays(e.startsAt, now)}</span>
                          <span className="text-sm text-muted">
                            {o.tickets.length} {o.tickets.length === 1 ? "ticket" : "tickets"} · {free ? "Free registration" : `${types.join(", ")} · ${birr(o.total)}`}
                          </span>
                        </div>
                        <h2 className="m-0 font-display text-[26px] font-bold leading-[1.1] tracking-[-0.025em]">
                          <Link href={`/events/${e.slug}`} className="text-ink no-underline hover:text-ink">
                            {e.title}
                          </Link>
                        </h2>
                        <div className="text-muted">
                          {dateShort(e.startsAt)} · {timeLabel(e.startsAt)} · {where(e.venueName, e.venueAddress)}
                        </div>
                        {unnamed && (
                          <div className="flex items-center gap-2 font-semibold text-rose-ink">
                            <Icon name="alert" size={18} />
                            Ticket {unnamed.seq} has no guest name yet
                          </div>
                        )}
                        {pendingRefund && <div className="badge badge-warn self-start">Refund request sent to the organizer</div>}
                        <div className="flex flex-wrap gap-2 pt-1.5">
                          <Link href={`/tickets/${o.tickets[0].code}`} className="btn btn-dark btn-md">
                            {o.tickets.length === 1 ? "View ticket" : "View tickets"}
                          </Link>
                          {unnamed && <SendToGuest ticketId={unnamed.id} label="Send to a guest" />}
                          <a href={`/api/events/${e.id}/calendar`} className="btn">
                            Add to calendar
                          </a>
                          {!pendingRefund && !o.tickets.some((t) => t.status === "CHECKED_IN") && <RefundButton orderId={o.id} free={free} label={free ? "Cancel registration" : "Request refund"} />}
                        </div>
                        {daysUntil(e.startsAt, now) > 0 && null}
                      </div>
                    </article>
                  </div>
                );
              })}
            </>
          )}

          {tab === "past" && (
            <section className="flex flex-col">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
                <h2 className="h2">Recently attended</h2>
              </div>
              {past.length === 0 && <p className="py-6 text-muted">Events you've been to will appear here.</p>}
              {past.map((o) => {
                const checked = o.tickets.find((t) => t.status === "CHECKED_IN");
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line2 py-4">
                    <div className="min-w-[260px] flex-[1_1_300px]">
                      <div className="font-bold">{o.event.title}</div>
                      <div className="text-[15px] text-muted">
                        {dateShort(o.event.startsAt)} · {where(o.event.venueName, o.event.venueAddress)} ·{" "}
                        {checked?.checkedInAt ? `Checked in ${timeLabel(checked.checkedInAt)}` : "Didn't check in"}
                      </div>
                    </div>
                    <Link href={`/orders/${o.id}`} className="text-[15px] font-semibold">
                      Receipt
                    </Link>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "refunded" && (
            <section className="flex flex-col">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
                <h2 className="h2">Refunded orders</h2>
              </div>
              {refunded.length === 0 && <p className="py-6 text-muted">No refunds. Orders you cancel or that an organizer cancels will show here.</p>}
              {refunded.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line2 py-4">
                  <div className="min-w-[260px] flex-[1_1_300px]">
                    <div className="font-bold">{o.event.title}</div>
                    <div className="text-[15px] text-muted">
                      {o.event.status === "CANCELLED" ? "Cancelled by the organizer" : "Refunded at your request"} · {o.total > 0 ? birr(o.total) : "Free registration"}
                      {o.refundedAt ? ` · ${dateShort(o.refundedAt)}` : ""}
                    </div>
                  </div>
                  <span className="badge badge-danger">Refunded</span>
                  <Link href={`/orders/${o.id}`} className="text-[15px] font-semibold">
                    Receipt
                  </Link>
                </div>
              ))}
            </section>
          )}
        </div>

        <ProfilePanel
          profile={{ name: user.name, email: user.email, phone: formatPhone(user.phone), city: user.city }}
          prefs={user.prefs}
          organizer={user.role === "ORGANIZER"}
        />
      </main>
    </div>
  );
}
