import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/components/organizer/copy-link";
import { Lifecycle } from "@/components/organizer/lifecycle";
import { Icon } from "@/components/ui/icon";
import { eventAnalytics } from "@/lib/analytics";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { birr, dateTime, n } from "@/lib/format";
import { publishChecklist } from "@/lib/publishing";

export const metadata: Metadata = { title: "Event overview" };

export default async function EventOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}`);
  const event = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, include: { ticketTypes: true, organizer: true } });
  if (!event) notFound();
  const [a, recent, checkedIn] = await Promise.all([
    eventAnalytics(id),
    db.order.findMany({ where: { eventId: id, status: { in: ["PAID", "REFUNDED"] } }, orderBy: { paidAt: "desc" }, take: 5, include: { _count: { select: { tickets: true } } } }),
    db.ticket.count({ where: { eventId: id, status: "CHECKED_IN" } }),
  ]);
  const checklist = publishChecklist(event);
  const missing = checklist.filter((c) => !c.done);
  const s = a.summary;
  const editable = event.status === "DRAFT" || event.status === "REJECTED";

  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-7 sm:px-8">
      {event.status === "REJECTED" && (
        <div role="alert" className="rounded-xl border-2 border-danger bg-white px-5 py-4">
          <div className="font-bold text-danger">This event wasn't approved</div>
          <div>{event.reviewReason || "Contact support for details."}</div>
        </div>
      )}
      {event.status === "DRAFT" && event.reviewReason && (
        <div role="status" className="rounded-xl bg-warn-bg px-5 py-4 text-warn-ink">
          <div className="font-bold">Changes requested by Tamasha</div>
          <div>{event.reviewReason}</div>
        </div>
      )}
      {event.status === "PENDING_REVIEW" && (
        <div role="status" className="rounded-xl bg-warn-bg px-5 py-4 text-warn-ink">
          <div className="font-bold">Waiting for review</div>
          <div>Our team is checking this event ({event.flag || "routine review"}). It goes live as soon as it's approved, usually within a few hours.</div>
        </div>
      )}
      {event.status === "PUBLISHED" && event.flag && (
        <div role="status" className="rounded-xl bg-warn-bg px-5 py-4 text-warn-ink">
          <div className="font-bold">Under review: {event.flag}</div>
          <div>Your event stays on sale while we take a look.</div>
        </div>
      )}

      <section className="grid border-b border-line2 border-t-2 border-t-ink" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
        <div className="py-5 pr-6">
          <div className="text-muted">Tickets sold</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">
            {n(s.sold)} <span className="text-xl font-semibold text-muted">/ {n(s.totalQuantity)}</span>
          </div>
          <div className="meter mt-2">
            <span style={{ width: `${s.soldPct}%` }} />
          </div>
        </div>
        <div className="border-l border-line2 px-6 py-5 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Gross sales</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{birr(a.gross)}</div>
          <div className="text-sm text-muted">{n(a.orders)} orders</div>
        </div>
        <div className="border-l border-line2 px-6 py-5 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Page views</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{n(a.views)}</div>
          <div className="text-sm text-muted">{a.conversion}% became orders</div>
        </div>
        <div className="border-l border-line2 px-6 py-5 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Checked in</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{n(checkedIn)}</div>
          <div className="text-sm text-muted">of {n(s.sold)} ticket holders</div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-10">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h2">Ticket types</h2>
              <Link href={`/organizer/events/${id}/tickets`} className="font-semibold">
                Edit tickets
              </Link>
            </div>
            <div className="table-card">
              <table style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col" style={{ width: "38%" }}>
                      Sold
                    </th>
                    <th scope="col" className="text-right">
                      Gross
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {a.byType.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="font-bold">
                          {t.name} {t.state === "SOLD_OUT" && <span className="ml-1 rounded-md bg-ink px-2 py-0.5 text-xs text-white">Sold out</span>}
                        </div>
                        <div className="text-sm text-muted">{t.kind === "FREE" ? "Free" : birr(t.price)}</div>
                      </td>
                      <td>
                        <div className="text-sm font-semibold">
                          {n(t.sold)} / {n(t.quantity)}
                        </div>
                        <div className="meter mt-1.5">
                          <span style={{ width: `${t.quantity ? Math.round((t.sold / t.quantity) * 100) : 0}%` }} />
                        </div>
                      </td>
                      <td className="text-right font-semibold whitespace-nowrap">{birr(t.gross)}</td>
                    </tr>
                  ))}
                  {a.byType.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted">
                        No ticket types yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h2">Latest orders</h2>
              <Link href="/organizer/orders" className="font-semibold">
                All orders
              </Link>
            </div>
            <div className="card divide-y divide-line">
              {recent.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                  <div>
                    <div className="font-semibold">{o.name}</div>
                    <div className="text-sm text-muted">
                      #{o.code} · {o._count.tickets} {o._count.tickets === 1 ? "ticket" : "tickets"} · {o.paidAt ? dateTime(o.paidAt) : ""}
                    </div>
                  </div>
                  <div className="font-semibold">{o.status === "REFUNDED" ? <span className="badge badge-danger">Refunded</span> : o.total === 0 ? "Free" : birr(o.total)}</div>
                </div>
              ))}
              {recent.length === 0 && <p className="m-0 px-5 py-6 text-center text-muted">No orders yet.</p>}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-8">
          {editable && (
            <section className="flex flex-col">
              <h2 className="h2 border-b-2 border-ink pb-2.5">Before you can publish</h2>
              {checklist.map((c) => (
                <div key={c.key} className={`flex min-h-12 items-center gap-3 border-b border-line2 ${c.done ? "" : "font-semibold"}`}>
                  {c.done ? <Icon name="check" size={18} stroke={3} className="text-primary" /> : <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-field" />}
                  <span className="flex-1">{c.label}</span>
                  {!c.done && (
                    <Link href={`/organizer/events/${id}/edit${c.key === "tickets" ? "?step=tickets" : c.key === "basics" ? "?step=where" : c.key === "payout" ? "" : "?step=page"}`} className="text-sm font-semibold">
                      {c.key === "payout" ? "" : "Fix"}
                    </Link>
                  )}
                </div>
              ))}
              {checklist.some((c) => c.key === "payout" && !c.done) && (
                <Link href="/organizer/settings" className="pt-2 text-sm font-semibold">
                  Add or verify your payout account
                </Link>
              )}
              <div className="pt-4">
                <Lifecycle eventId={id} status={event.status} ready={missing.length === 0} soldCount={0} verified={user.organizer!.verified} />
                {missing.length > 0 && <div className="pt-2 text-sm text-muted">{missing.length} {missing.length === 1 ? "step" : "steps"} to go</div>}
              </div>
            </section>
          )}

          {(event.status === "PUBLISHED" || event.status === "PENDING_REVIEW") && (
            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
              <h2 className="h2">Share your event</h2>
              <code className="mono break-all rounded-lg bg-bg px-3 py-2 text-[13px]">/events/{event.slug}</code>
              <div className="flex flex-wrap gap-2">
                <CopyLink path={`/events/${event.slug}?src=whatsapp`} label="Copy WhatsApp link" className="btn" />
                <CopyLink path={`/events/${event.slug}?src=instagram`} label="Copy Instagram link" className="btn" />
              </div>
              <p className="m-0 text-sm text-muted">Links tagged with the channel show up under “Where buyers came from” in Analytics.</p>
              <Lifecycle eventId={id} status={event.status} ready soldCount={s.sold} verified={user.organizer!.verified} />
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
