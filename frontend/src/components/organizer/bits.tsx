import Link from "next/link";
import type { OrgEventRow } from "@/lib/types";
import { birr, dateShort, daysUntil, n } from "@/lib/format";

export type StatusInfo = { label: string; cls: string };

/** Human status for an event row (organizer views). */
export function eventStatus(e: { status: string; phase: string; startsAt: string; flag?: string }): StatusInfo {
  if (e.status === "DRAFT") return { label: "Draft", cls: "badge-warn" };
  if (e.status === "PENDING_REVIEW") return { label: "Waiting for review", cls: "badge-warn" };
  if (e.status === "REJECTED") return { label: "Not approved", cls: "badge-danger" };
  if (e.status === "CANCELLED") return { label: "Cancelled", cls: "badge-danger" };
  if (e.phase === "ENDED") return { label: "Ended", cls: "badge-neutral" };
  if (e.phase === "LIVE") return { label: "Happening now", cls: "badge-rose" };
  return { label: "On sale", cls: "badge-tint" };
}

export function StatCell({ label, value, sub, first = false, subTone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; first?: boolean; subTone?: "danger" }) {
  return (
    <div className={`flex flex-col gap-0.5 py-5 ${first ? "pr-6" : "border-l border-line2 px-6 max-md:border-l-0 max-md:pl-0"}`}>
      <div className="text-muted">{label}</div>
      <div className="font-display text-[34px] font-bold leading-tight tracking-[-0.03em]">{value}</div>
      {sub ? <div className={`text-sm ${subTone === "danger" ? "font-semibold text-danger" : "text-muted"}`}>{sub}</div> : null}
    </div>
  );
}

export function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted">First 30 days</span>;
  return (
    <>
      <span className={`font-bold ${pct >= 0 ? "text-primary-dark" : "text-danger"}`}>
        {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
      </span>{" "}
      <span className="text-muted">vs previous 30 days</span>
    </>
  );
}

export function EventsTable({ rows, empty }: { rows: OrgEventRow[]; empty?: React.ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="table-card">
      <table style={{ minWidth: 680 }}>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Status</th>
            <th scope="col" style={{ width: 200 }}>
              Sold
            </th>
            <th scope="col" className="text-right">
              Gross
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const st = eventStatus(e);
            const href = e.status === "DRAFT" ? `/organizer/events/${e.id}/edit` : `/organizer/events/${e.id}`;
            return (
              <tr key={e.id}>
                <td>
                  <Link href={href} className="font-bold text-ink no-underline hover:underline">
                    {e.title}
                  </Link>
                  <div className="text-sm text-muted">
                    {dateShort(e.startsAt)} · {e.venueName}
                  </div>
                  {e.flag && e.status !== "PENDING_REVIEW" && <div className="mt-1 text-xs font-semibold text-warn-ink">Under review: {e.flag}</div>}
                  {e.reviewReason && (e.status === "DRAFT" || e.status === "REJECTED") && <div className="mt-1 text-xs font-semibold text-danger">Admin note: {e.reviewReason}</div>}
                </td>
                <td>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </td>
                <td>
                  {e.status === "DRAFT" && e.types.length === 0 ? (
                    <span className="text-sm text-muted">Tickets not set up</span>
                  ) : e.phase === "ENDED" ? (
                    <>
                      <div className="text-sm font-semibold">
                        {n(e.sold)} / {n(e.totalQuantity)}
                      </div>
                      <div className="text-[13px] text-muted">{n(e.checkedIn)} checked in</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">
                        {n(e.sold)} / {n(e.totalQuantity)}
                      </div>
                      <div className="meter mt-1.5">
                        <span style={{ width: `${e.soldPct}%` }} />
                      </div>
                    </>
                  )}
                </td>
                <td className="text-right font-semibold whitespace-nowrap">
                  {e.status === "DRAFT" ? (
                    <Link href={href} className="font-semibold">
                      Finish setup
                    </Link>
                  ) : (
                    birr(e.gross)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SalesBars({ data }: { data: { key: string; date: string; tickets: number }[] }) {
  const max = Math.max(40, ...data.map((d) => d.tickets));
  const top = Math.ceil(max / 10) * 10;
  const peak = data.reduce((best, d) => (d.tickets > best.tickets ? d : best), data[0] ?? { tickets: 0, key: "" });
  const last = data[data.length - 1];
  const label = (d: { date: string }) => dateShort(d.date);
  return (
    <div>
      <div
        role="img"
        aria-label={`Bar chart of tickets sold per day from ${data[0] ? label(data[0]) : ""} to ${last ? label(last) : ""}. Peak of ${peak.tickets} on ${label(peak as { date: string })}; ${last?.tickets ?? 0} today.`}
        className="relative h-[200px] pl-8"
      >
        {[top, top / 2, 0].map((v, i) => (
          <div key={i}>
            <div className="absolute left-8 right-0 border-t" style={{ top: i * 100, borderColor: i === 2 ? "#A9A3BF" : "#E4E1EC" }} />
            <div className="absolute left-0 text-xs text-muted" style={{ top: i * 100 - 9 }}>
              {v}
            </div>
          </div>
        ))}
        <div className="relative flex h-[200px] items-end justify-around gap-1 px-2">
          {data.map((d, i) => {
            const h = Math.round((d.tickets / top) * 200);
            const emph = d === peak || i === data.length - 1;
            return (
              <div key={d.key} title={`${label(d)}: ${d.tickets} tickets`} className="relative w-[22px] rounded-t bg-primary max-sm:w-3" style={{ height: Math.max(h, d.tickets > 0 ? 3 : 0) }}>
                {emph && d.tickets > 0 && <span className="absolute left-1/2 -top-[22px] -translate-x-1/2 text-[13px] font-bold">{d.tickets}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between pl-8 pt-1.5 text-xs text-muted">
        <span>{data[0] ? label(data[0]) : ""}</span>
        <span>{data[7] ? label(data[7]) : ""}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export const untilLabel = (iso: string) => {
  const d = daysUntil(iso);
  return d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
};
