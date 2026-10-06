import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { CopyLink } from "@/components/organizer/copy-link";
import { Delta, EventsTable, SalesBars, StatCell } from "@/components/organizer/bits";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import type { Dashboard } from "@/lib/types";
import { birr, dateLong, dateShort, n, timeLabel, waiting, where } from "@/lib/format";

export const metadata: Metadata = { title: "Organizer home" };

export default async function OrganizerHome() {
  const user = await requirePage(["ORGANIZER"], "/organizer");
  const d = await apiGet<Dashboard>("/organizer/dashboard");
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user.name.split(" ")[0];
  const next = d.next;
  const left = next ? next.totalQuantity - next.sold : 0;
  const lowest = d.lowStock[0];

  if (d.events.length === 0) {
    return (
      <>
        <OrganizerHeader user={user} current="home" />
        <main className="mx-auto max-w-[1360px] px-4 py-10 sm:px-8">
          <div className="mx-auto flex max-w-[520px] flex-col gap-3.5 rounded-[20px] bg-night px-6 py-7 text-white">
            <div className="font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em]">Your first event is about ten minutes away</div>
            <div className="flex flex-col">
              {["Name it, pick a date and a venue", "Add one ticket type, free or paid", "Publish and share your link"].map((t, i, a) => (
                <div key={t} className={`flex gap-3.5 border-t border-night3 py-3 ${i === a.length - 1 ? "border-b" : ""}`}>
                  <span className="mono text-sun">{String(i + 1).padStart(2, "0")}</span>
                  {t}
                </div>
              ))}
            </div>
            <Link href="/organizer/events/new" className="btn btn-white btn-lg btn-block on-dark">
              Create your first event
            </Link>
            <div className="text-sm text-soft">Free events cost nothing. Paid tickets carry a 5% fee, included in the price buyers see.</div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <OrganizerHeader user={user} current="home" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-muted">{dateLong(now)}</div>
            <h1 className="h-display text-[clamp(30px,4vw,40px)] leading-[1.05]">
              {greeting}, {first}
            </h1>
          </div>
          <div className="text-muted">Showing the last 30 days</div>
        </div>

        {!user.organizer!.verified && (
          <div role="status" className="rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">
            <strong>Your organizer account isn't verified yet.</strong> New events go through a quick review before they appear on Tamasha. {!user.organizer!.payoutVerified && "Add and verify a payout account to sell paid tickets. "}
            <Link href="/organizer/settings" className="font-semibold text-warn-ink">
              Open settings
            </Link>
          </div>
        )}

        {next ? (
          <section aria-label="Next event" className="flex flex-wrap items-center gap-x-12 gap-y-7 rounded-[20px] bg-night px-8 py-7 text-white max-sm:px-5">
            <div className="flex min-w-[260px] flex-[1.2_1_320px] flex-col gap-1.5">
              <div className="mono text-xs tracking-[0.06em] text-sun">{next.phase === "LIVE" ? "HAPPENING NOW" : `NEXT EVENT · ${Math.max(0, Math.ceil((new Date(next.startsAt).getTime() - now.getTime()) / 86_400_000))} DAYS TO GO`}</div>
              <h2 className="m-0 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.03em]">{next.title}</h2>
              <div className="text-soft">
                {dateShort(next.startsAt)} · {timeLabel(next.startsAt)} · {where(next.venueName, next.venueAddress)}
              </div>
            </div>
            <div className="flex min-w-[240px] flex-[1_1_280px] flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="font-display text-[34px] font-bold tracking-[-0.03em]">{n(next.sold)}</span> <span className="text-soft">of {n(next.totalQuantity)} sold</span>
                </div>
                <div className="font-bold">{next.soldPct}%</div>
              </div>
              <div role="img" aria-label={`${next.sold} of ${next.totalQuantity} tickets sold`} className="meter-dark">
                <span style={{ width: `${next.soldPct}%` }} />
              </div>
              <div className="flex justify-between gap-3 text-sm text-soft">
                <span>
                  {n(left)} left{lowest ? ` · ${lowest.type.name} nearly gone` : ""}
                </span>
                <span className="font-semibold text-white">{birr(next.gross)} gross</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/organizer/events/${next.id}`} className="btn btn-white btn-md on-dark">
                Manage event
              </Link>
              <Link href={`/organizer/events/${next.id}/analytics`} className="btn btn-ghost-dark btn-md on-dark">
                Analytics
              </Link>
              <CopyLink path={`/events/${next.slug}`} />
            </div>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-night px-8 py-7 text-white">
            <div>
              <div className="font-display text-2xl font-bold">No upcoming events on sale</div>
              <div className="text-soft">Create an event or finish a draft to start selling.</div>
            </div>
            <Link href="/organizer/events/new" className="btn btn-white btn-md on-dark">
              Create event
            </Link>
          </section>
        )}

        <section aria-label="Key numbers, last 30 days" className="grid border-b border-line2 border-t-2 border-t-ink" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          <StatCell first label="Net revenue" value={birr(d.cur.net)} sub={<Delta pct={d.netChange} />} />
          <StatCell label="Tickets sold" value={n(d.cur.tickets)} sub={<Delta pct={d.ticketChange} />} />
          <StatCell label="Events on sale" value={d.liveCount} sub={d.drafts.length ? `${d.drafts.length} ${d.drafts.length === 1 ? "draft" : "drafts"} waiting to publish` : "No drafts"} />
          <StatCell label="Turn-up rate" value={d.turnUp === null ? "—" : `${d.turnUp}%`} sub={d.turnUp === null ? "Shows after your first finished event" : "of ticket holders checked in at your last event"} />
        </section>

        <div className="flex flex-wrap items-start gap-x-12 gap-y-10">
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-10">
            {d.chart.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="h2">Tickets sold per day, last 14 days</h2>
                  <span className="text-muted">
                    {n(d.chart.reduce((s, x) => s + x.tickets, 0))} tickets · {d.chartEvent ? d.chartEvent.title : "all events"}
                  </span>
                </div>
                <SalesBars data={d.chart} />
              </section>
            )}

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="h2">Your events</h2>
                <Link href="/organizer/events" className="font-semibold">
                  All events
                </Link>
              </div>
              <EventsTable rows={[...d.events].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 6)} />
            </section>
          </div>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-9">
            <section className="flex flex-col">
              <h2 className="h2 border-b-2 border-ink pb-2.5">Needs you</h2>
              {d.refundRequests.length > 0 && (
                <div className="flex items-center gap-3 border-b border-line2 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {d.refundRequests.length} refund {d.refundRequests.length === 1 ? "request" : "requests"}
                    </div>
                    <div className="text-sm text-muted">
                      {d.refundRequests[0].order.event.title} · oldest waiting {waiting(d.refundRequests[0].createdAt)}
                    </div>
                  </div>
                  <Link href="/organizer/orders#refunds" className="btn">
                    Review
                  </Link>
                </div>
              )}
              {d.lowStock.slice(0, 2).map(({ event, type }) => (
                <div key={event.id + type.id} className="flex items-center gap-3 border-b border-line2 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {type.name} has {type.left} left
                    </div>
                    <div className="truncate text-sm text-muted">{event.title}</div>
                  </div>
                  <Link href={`/organizer/events/${event.id}/tickets`} className="btn">
                    Edit tickets
                  </Link>
                </div>
              ))}
              {d.drafts.slice(0, 2).map((e) => (
                <div key={e.id} className="flex items-center gap-3 border-b border-line2 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">Finish your {e.title} draft</div>
                    <div className="text-sm text-muted">{e.ticketTypeCount === 0 ? "Tickets not set up yet" : "Almost ready to publish"}</div>
                  </div>
                  <Link href={`/organizer/events/${e.id}/edit`} className="btn">
                    Continue
                  </Link>
                </div>
              ))}
              {d.refundRequests.length === 0 && d.lowStock.length === 0 && d.drafts.length === 0 && <p className="py-4 text-muted">Nothing needs you right now.</p>}
            </section>

            {d.nextPayout && (
              <section className="flex flex-col gap-1.5 rounded-2xl border border-line bg-white px-6 py-[22px]">
                <div className="text-muted">Next payout</div>
                <div className="font-display text-[30px] font-bold tracking-[-0.03em]">{birr(d.nextPayout.amount)}</div>
                <div className="text-sm text-muted">
                  Arrives {dateShort(d.nextPayout.date)}
                  {user.organizer!.payoutVerified ? "" : " once your payout account is verified"}. {d.nextPayout.event.title} pays out 3 days after the event.
                </div>
                <Link href="/organizer/payouts" className="pt-1.5 font-semibold">
                  Payout schedule
                </Link>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
