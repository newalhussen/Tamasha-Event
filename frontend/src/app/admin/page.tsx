import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { OrganizerReview, type OrgInfo } from "@/components/admin/organizer-review";
import { StatCell } from "@/components/organizer/bits";
import { requirePage } from "@/lib/auth";
import { birr, dateShort, n } from "@/lib/format";
import { apiGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Admin overview" };

const TONE = { danger: "badge-danger", warn: "badge-warn", neutral: "badge-neutral" } as const;

type Overview = {
  stats: { live: number; queueCount: number; soldToday: number; revenueToday: number; newOrgs: number; pendingOrgs: number; openReports: number; staleReports: number };
  queue: { id: string; title: string; organizerNote: string; reason: string; tone: keyof typeof TONE; waitingLabel: string; waitingMs: number }[];
  currentId: string | null;
  currentReason: { reason: string; tone: keyof typeof TONE } | null;
  detail: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    venueName: string;
    status: string;
    free: boolean;
    minPrice: number;
    sold: number;
    reportReasons: string[];
    firstReportDetails: string;
    organizer: { name: string; createdAt: string; otherEvents: number; payoutVerified: boolean; payoutSubmitted: boolean };
    dupe: { organizerName: string; organizerVerified: boolean; priceDiff: number } | null;
  } | null;
  orgs: (OrgInfo & { payoutSubmitted: boolean })[];
  log: { id: string; action: string; note: string; createdAt: string; admin: { name: string }; event: { title: string } | null }[];
};

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e: selected } = await searchParams;
  await requirePage(["ADMIN"], "/admin");
  const o = await apiGet<Overview>(`/admin/overview${selected ? `?e=${encodeURIComponent(selected)}` : ""}`);
  const { stats, queue, detail, orgs, log } = o;
  const current = o.currentReason;
  const now = new Date();

  return (
    <>
      <AdminChrome current="overview" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-8 sm:px-8">
        <div>
          <div className="text-muted">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", weekday: "long", day: "numeric", month: "long" }).format(now)}</div>
          <h1 className="h-display text-[clamp(30px,4vw,40px)] leading-[1.05]">Platform overview</h1>
        </div>

        <section aria-label="Platform numbers" className="grid border-b border-line2 border-t-2 border-t-ink" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          <StatCell first label="Events live" value={n(stats.live)} sub={`${stats.queueCount} waiting for review`} />
          <StatCell label="Tickets sold, last 24 hours" value={n(stats.soldToday)} sub={`${birr(stats.revenueToday)} processed`} />
          <StatCell label="New organizers this week" value={n(stats.newOrgs)} sub={`${stats.pendingOrgs} awaiting verification`} />
          <StatCell
            label="Open reports"
            value={stats.openReports}
            sub={stats.openReports ? (stats.staleReports ? `${stats.staleReports} older than 24 hours` : "All within 24 hours") : "All clear"}
            subTone={stats.staleReports ? "danger" : undefined}
          />
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
                    <th scope="col">Why it&apos;s here</th>
                    <th scope="col" className="text-right">
                      Waiting
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((q) => {
                    const active = q.id === o.currentId;
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
                <h2 className="mb-0 mt-1 font-display text-2xl font-bold leading-[1.15] tracking-[-0.02em]">{detail.title}</h2>
                <div className="text-muted">
                  {dateShort(detail.startsAt)} · {detail.venueName} · {detail.free ? "Free" : birr(detail.minPrice)}
                </div>
              </div>
              <div className="flex flex-col">
                {detail.dupe && (
                  <div className="flex gap-3 border-t border-line py-3">
                    <span className="w-[110px] flex-none text-muted">Match</span>
                    <span>
                      Same name and venue as a live event by <strong>{detail.dupe.organizerName}</strong>
                      {detail.dupe.organizerVerified ? " (verified)" : ""}
                      {detail.dupe.priceDiff > 0 ? `, priced ${birr(detail.dupe.priceDiff)} lower.` : "."}
                    </span>
                  </div>
                )}
                {detail.reportReasons.length > 0 && (
                  <div className="flex gap-3 border-t border-line py-3">
                    <span className="w-[110px] flex-none text-muted">Reports</span>
                    <span>
                      {detail.reportReasons.join(", ")}. {detail.firstReportDetails ? `“${detail.firstReportDetails}”` : ""}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 border-t border-line py-3">
                  <span className="w-[110px] flex-none text-muted">Organizer</span>
                  <span>
                    {detail.organizer.name}. Account created {dateShort(detail.organizer.createdAt)}. {detail.organizer.otherEvents} other {detail.organizer.otherEvents === 1 ? "event" : "events"}.{" "}
                    {detail.organizer.payoutVerified ? "Payout account verified." : detail.organizer.payoutSubmitted ? "Payout account not verified." : "No payout account."}
                  </span>
                </div>
                <div className="flex gap-3 border-y border-line py-3">
                  <span className="w-[110px] flex-none text-muted">Exposure</span>
                  <span>
                    {detail.status === "PUBLISHED" ? "Live on Tamasha." : "Not published."} {n(detail.sold)} tickets sold.
                  </span>
                </div>
              </div>
              <ModerationPanel
                key={detail.id}
                eventId={detail.id}
                defaultNote={detail.dupe ? "This listing duplicates an event run by a verified organizer." : detail.reportReasons.length ? "This event was reported by attendees and doesn't meet our listing standards." : ""}
              />
              <Link href={`/events/${detail.slug}`} target="_blank" className="text-sm font-semibold">
                Open event page
              </Link>
            </aside>
          )}
        </div>

        <section className="flex flex-col">
          <div className="sec-head">
            <h2 className="h2">Organizers awaiting verification</h2>
            <Link href="/admin/organizers" className="font-semibold">
              All {stats.pendingOrgs}
            </Link>
          </div>
          {orgs.length === 0 && <p className="py-4 text-muted">No organizers are waiting.</p>}
          {orgs.map((org) => (
            <div key={org.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line2 py-3.5">
              <div className="min-w-[240px] flex-[1_1_260px]">
                <div className="font-bold">{org.name}</div>
                <div className="text-sm text-muted">
                  {org.payoutSubmitted ? (org.payoutVerified ? "Payout account verified" : "Payout account submitted, not verified") : "Payout account missing"} · {org.events} {org.events === 1 ? "event" : "events"} created
                </div>
              </div>
              <span className="text-muted">Joined {org.joined}</span>
              <OrganizerReview org={org} />
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
