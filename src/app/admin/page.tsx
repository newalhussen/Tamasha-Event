import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { OrganizerReview } from "@/components/admin/organizer-review";
import { StatCell } from "@/components/organizer/bits";
import { reviewDetail, reviewQueue } from "@/lib/admin";
import { orgInfo } from "@/lib/admin-view";
import { db } from "@/lib/db";
import { birr, dateShort, n, where } from "@/lib/format";

export const metadata: Metadata = { title: "Admin overview" };

const TONE = { danger: "badge-danger", warn: "badge-warn", neutral: "badge-neutral" } as const;

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e: selected } = await searchParams;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [queue, live, soldToday, revenueToday, newOrgs, pendingOrgs, openReports, orgs, log] = await Promise.all([
    reviewQueue(now),
    db.event.count({ where: { status: "PUBLISHED", OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] } }),
    db.ticket.count({ where: { status: { in: ["VALID", "CHECKED_IN"] }, order: { paidAt: { gte: dayAgo } } } }),
    db.ticket.aggregate({ where: { status: { in: ["VALID", "CHECKED_IN"] }, order: { paidAt: { gte: dayAgo } } }, _sum: { price: true } }),
    db.organizer.count({ where: { createdAt: { gte: weekAgo } } }),
    db.organizer.count({ where: { status: "PENDING" } }),
    db.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.organizer.findMany({ where: { status: "PENDING" }, include: { user: true, _count: { select: { events: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.moderationLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { admin: true, event: { select: { title: true } } } }),
  ]);

  const current = queue.find((q) => q.id === selected) ?? queue[0];
  const detail = current ? await reviewDetail(current.id, now) : null;
  const oldest = openReports[0];
  const staleReports = openReports.filter((r) => now.getTime() - r.createdAt.getTime() > 86_400_000).length;

  return (
    <>
      <AdminChrome current="overview" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-8 sm:px-8">
        <div>
          <div className="text-muted">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", weekday: "long", day: "numeric", month: "long" }).format(now)}</div>
          <h1 className="h-display text-[clamp(30px,4vw,40px)] leading-[1.05]">Platform overview</h1>
        </div>

        <section aria-label="Platform numbers" className="grid border-b border-line2 border-t-2 border-t-ink" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          <StatCell first label="Events live" value={n(live)} sub={`${queue.length} waiting for review`} />
          <StatCell label="Tickets sold, last 24 hours" value={n(soldToday)} sub={`${birr(revenueToday._sum.price ?? 0)} processed`} />
          <StatCell label="New organizers this week" value={n(newOrgs)} sub={`${pendingOrgs} awaiting verification`} />
          <StatCell label="Open reports" value={openReports.length} sub={oldest ? (staleReports ? `${staleReports} older than 24 hours` : "All within 24 hours") : "All clear"} subTone={staleReports ? "danger" : undefined} />
        </section>

        <div className="flex flex-wrap items-start gap-x-10 gap-y-8">
          <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h2">Events waiting for review</h2>
              <span className="text-muted">Verified organizers publish without review</span>
            </div>
            <div className="table-card">
              <table style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th scope="col">Event and organizer</th>
                    <th scope="col">Why it's here</th>
                    <th scope="col" className="text-right">
                      Waiting
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((q) => {
                    const active = q.id === current?.id;
                    return (
                      <tr key={q.id} className={active ? "bg-tint" : ""} style={active ? { boxShadow: "inset 4px 0 0 #4B2BFF" } : undefined}>
                        <td>
                          <Link href={`/admin?e=${q.id}`} className="font-bold text-ink no-underline hover:underline">
                            {q.title}
                          </Link>
                          <div className={`text-sm ${active ? "text-neutral-ink" : "text-muted"}`}>{q.organizerNote}</div>
                        </td>
                        <td>
                          <span className={`badge ${TONE[q.tone]}`}>{q.reason}</span>
                        </td>
                        <td className={`text-right font-semibold whitespace-nowrap ${q.waitingMs > 86_400_000 ? "text-danger" : ""}`}>{q.waitingLabel}</td>
                      </tr>
                    );
                  })}
                  {queue.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-muted">
                        The queue is empty. Nothing needs a decision right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {detail && current && (
            <aside aria-label="Selected event" className="flex min-w-0 flex-[1_1_400px] flex-col gap-[18px] rounded-[20px] border border-line bg-white p-6">
              <div>
                <div className={`mono text-xs uppercase tracking-[0.04em] ${current.tone === "danger" ? "text-danger" : "text-warn-ink"}`}>{current.reason}</div>
                <h2 className="mb-0 mt-1 font-display text-2xl font-bold leading-[1.15] tracking-[-0.02em]">{detail.event.title}</h2>
                <div className="text-muted">
                  {dateShort(detail.event.startsAt)} · {detail.event.venueName} · {detail.summary.free ? "Free" : birr(detail.summary.minPrice)}
                </div>
              </div>
              <div className="flex flex-col">
                {detail.dupe && (
                  <div className="flex gap-3 border-t border-line py-3">
                    <span className="w-[110px] flex-none text-muted">Match</span>
                    <span>
                      Same name and venue as a live event by <strong>{detail.dupe.organizer.name}</strong>
                      {detail.dupe.organizer.verified ? " (verified)" : ""}
                      {(() => {
                        const live = Math.min(...detail.dupe!.ticketTypes.map((t) => t.price));
                        const diff = live - detail.summary.minPrice;
                        return diff > 0 ? `, priced ${birr(diff)} lower.` : ".";
                      })()}
                    </span>
                  </div>
                )}
                {detail.event.reports.length > 0 && (
                  <div className="flex gap-3 border-t border-line py-3">
                    <span className="w-[110px] flex-none text-muted">Reports</span>
                    <span>
                      {detail.event.reports.map((r) => r.reason).filter((x, i, a) => a.indexOf(x) === i).join(", ")}.{" "}
                      {detail.event.reports[0]?.details ? `“${detail.event.reports[0].details}”` : ""}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 border-t border-line py-3">
                  <span className="w-[110px] flex-none text-muted">Organizer</span>
                  <span>
                    {detail.event.organizer.name}. Account created {dateShort(detail.event.organizer.createdAt)}. {detail.event.organizer._count.events - 1} other {detail.event.organizer._count.events - 1 === 1 ? "event" : "events"}.{" "}
                    {detail.event.organizer.payoutVerified ? "Payout account verified." : detail.event.organizer.payoutAccount ? "Payout account not verified." : "No payout account."}
                  </span>
                </div>
                <div className="flex gap-3 border-y border-line py-3">
                  <span className="w-[110px] flex-none text-muted">Exposure</span>
                  <span>
                    {detail.event.status === "PUBLISHED" ? "Live on Tamasha." : "Not published."} {n(detail.sold)} tickets sold.
                  </span>
                </div>
              </div>
              <ModerationPanel
                eventId={detail.event.id}
                defaultNote={
                  detail.dupe
                    ? "This listing duplicates an event run by a verified organizer."
                    : detail.event.reports.length
                      ? "This event was reported by attendees and doesn't meet our listing standards."
                      : ""
                }
              />
              <Link href={`/events/${detail.event.slug}`} target="_blank" className="text-sm font-semibold">
                Open event page
              </Link>
            </aside>
          )}
        </div>

        <section className="flex flex-col">
          <div className="sec-head">
            <h2 className="h2">Organizers awaiting verification</h2>
            <Link href="/admin/organizers" className="font-semibold">
              All {pendingOrgs}
            </Link>
          </div>
          {orgs.length === 0 && <p className="py-4 text-muted">No organizers are waiting.</p>}
          {orgs.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line2 py-3.5">
              <div className="min-w-[240px] flex-[1_1_260px]">
                <div className="font-bold">{o.name}</div>
                <div className="text-sm text-muted">
                  {o.payoutAccount ? (o.payoutVerified ? "Payout account verified" : "Payout account submitted, not verified") : "Payout account missing"} · {o._count.events} {o._count.events === 1 ? "event" : "events"} created
                </div>
              </div>
              <span className="text-muted">Joined {dateShort(o.createdAt)}</span>
              <OrganizerReview org={orgInfo(o)} />
            </div>
          ))}
        </section>

        <section className="flex flex-col">
          <div className="sec-head">
            <h2 className="h2">Recent decisions</h2>
          </div>
          {log.length === 0 && <p className="py-4 text-muted">No decisions logged yet.</p>}
          {log.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line2 py-3">
              <span className="badge badge-neutral">{l.action.replace(/_/g, " ").toLowerCase()}</span>
              <span className="min-w-[200px] flex-1">
                {l.event?.title ?? l.note} {l.note && l.event ? <span className="text-muted">· {l.note}</span> : null}
              </span>
              <span className="text-sm text-muted">
                {l.admin.name} · {dateShort(l.createdAt)}
              </span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
