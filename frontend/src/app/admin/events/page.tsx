import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { EventTakedown } from "@/components/admin/row-actions";
import { eventStatus } from "@/components/organizer/bits";
import { requirePage } from "@/lib/auth";
import { dateShort, n } from "@/lib/format";
import { apiGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Admin · Events" };
const STATUSES = [
  { key: "all", label: "All" },
  { key: "PUBLISHED", label: "Live" },
  { key: "PENDING_REVIEW", label: "In review" },
  { key: "DRAFT", label: "Drafts" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; page?: string }> }) {
  const { q = "", s = "all", page: rp } = await searchParams;
  const page = Math.max(1, Number(rp) || 1);
  await requirePage(["ADMIN"], "/admin/events");
  const { rows, total, pageSize } = await apiGet<{
    total: number;
    pageSize: number;
    rows: {
      id: string;
      slug: string;
      title: string;
      startsAt: string;
      venueName: string;
      status: string;
      phase: string;
      flag: string;
      organizer: { name: string; verified: boolean; status: string };
      tickets: number;
      openReports: number;
    }[];
  }>(`/admin/events?q=${encodeURIComponent(q)}&s=${s}&page=${page}`);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, s, ...over })) if (v && v !== "all") sp.set(k, v);
    return `/admin/events${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <AdminChrome current="events" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="h-display text-[clamp(30px,4vw,40px)]">Events</h1>
          <form action="/admin/events" role="search" className="flex gap-2">
            {s !== "all" && <input type="hidden" name="s" value={s} />}
            <label htmlFor="aq" className="sr-only">
              Search events
            </label>
            <input id="aq" name="q" defaultValue={q} type="search" placeholder="Search events or organizers" className="input !h-11 !w-[280px]" />
            <button className="btn btn-dark">Search</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((x) => (
            <Link key={x.key} href={href({ s: x.key, page: undefined })} className="pill" aria-pressed={s === x.key}>
              {x.label}
            </Link>
          ))}
        </div>
        <div className="table-card">
          <table style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Organizer</th>
                <th scope="col">Status</th>
                <th scope="col">Tickets</th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const st = eventStatus({ status: e.status, phase: e.phase, startsAt: e.startsAt });
                return (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/events/${e.slug}`} target="_blank" className="font-bold text-ink no-underline hover:underline">
                        {e.title}
                      </Link>
                      <div className="text-sm text-muted">
                        {dateShort(e.startsAt)} · {e.venueName}
                      </div>
                    </td>
                    <td>
                      {e.organizer.name}
                      <div className="text-[13px] text-muted">{e.organizer.verified ? "Verified" : e.organizer.status === "SUSPENDED" ? "Suspended" : "Unverified"}</div>
                    </td>
                    <td>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {e.openReports > 0 && <div className="mt-1 text-xs font-semibold text-danger">{e.openReports} open {e.openReports === 1 ? "report" : "reports"}</div>}
                      {e.flag && <div className="mt-1 text-xs font-semibold text-warn-ink">{e.flag}</div>}
                    </td>
                    <td>{n(e.tickets)}</td>
                    <td className="text-right">
                      {e.status === "PENDING_REVIEW" || e.flag || e.openReports > 0 ? (
                        <Link href={`/admin?e=${e.id}`} className="btn btn-dark">
                          Review
                        </Link>
                      ) : e.status === "PUBLISHED" ? (
                        <EventTakedown eventId={e.id} title={e.title} canCancel />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    No events match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between text-muted">
            <span>
              Page {page} of {pages} · {total} events
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={href({ page: String(page - 1) })} className="btn">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={href({ page: String(page + 1) })} className="btn">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
