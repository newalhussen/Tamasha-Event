import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { eventAnalytics } from "@/lib/analytics";
import { db } from "@/lib/db";
import { birr, dateShort, n, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Event analytics" };

function Cumulative({ a }: { a: Awaited<ReturnType<typeof eventAnalytics>> }) {
  const cap = Math.max(a.summary.totalQuantity, 1);
  const W = { x0: 40, x1: 790, yTop: 30, yBase: 230 };
  const series = a.series;
  const count = Math.max(series.length - 1, 1);
  const x = (i: number) => W.x0 + (i / count) * (W.x1 - 10 - W.x0);
  const y = (v: number) => W.yBase - (v / cap) * (W.yBase - W.yTop);
  const points = series.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const marks = a.soldOutMarks.map((m) => {
    const idx = Math.max(0, series.findIndex((s) => s.key === new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date(m.date!))));
    return { ...m, i: idx, px: x(idx), py: y(series[idx]?.total ?? 0) };
  });
  const firstDay = series[0];
  const mid = series[Math.floor(series.length / 2)];
  const desc = `Line chart of cumulative tickets sold from ${firstDay ? dateShort(firstDay.date) : ""} to today, reaching ${last?.total ?? 0} of ${cap}.`;
  return (
    <svg viewBox="0 0 820 270" role="img" aria-label={desc} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={W.x0} y1={W.yTop} x2={W.x1} y2={W.yTop} stroke="#8A859C" strokeDasharray="5 5" />
      <line x1={W.x0} y1={130} x2={W.x1} y2={130} stroke="#E4E1EC" />
      <line x1={W.x0} y1={W.yBase} x2={W.x1} y2={W.yBase} stroke="#A9A3BF" />
      <text x="32" y="34" textAnchor="end" fontSize="11" fill="#5F5A73">
        {cap}
      </text>
      <text x="32" y="134" textAnchor="end" fontSize="11" fill="#5F5A73">
        {Math.round(cap / 2)}
      </text>
      <text x="32" y="234" textAnchor="end" fontSize="11" fill="#5F5A73">
        0
      </text>
      <text x="48" y="22" fontSize="11" fill="#5F5A73">
        Capacity
      </text>
      {marks.map((m, k) => (
        <g key={m.name}>
          <line x1={m.px} y1={m.py} x2={m.px} y2={108 + k * 40} stroke="#A9A3BF" />
          <text x={Math.min(m.px + 6, 640)} y={106 + k * 40} fontSize="12" fontWeight="600" fill="#15121F">
            {m.name} sold out
          </text>
          <text x={Math.min(m.px + 6, 640)} y={121 + k * 40} fontSize="11" fill="#5F5A73">
            {dateShort(m.date!)} · {m.quantity} tickets
          </text>
          <circle cx={m.px} cy={m.py} r="4.5" fill="#4B2BFF" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
      <polyline fill="none" stroke="#4B2BFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
      {last && <circle cx={x(series.length - 1)} cy={y(last.total)} r="5" fill="#4B2BFF" stroke="#fff" strokeWidth="2" />}
      {last && (
        <text x="788" y={Math.max(18, y(last.total) - 10)} textAnchor="end" fontSize="14" fontWeight="700" fill="#15121F">
          {last.total}
        </text>
      )}
      {firstDay && (
        <text x="40" y="252" fontSize="11" fill="#5F5A73">
          {dateShort(firstDay.date)}
        </text>
      )}
      {mid && series.length > 6 && (
        <text x={x(Math.floor(series.length / 2))} y="252" textAnchor="middle" fontSize="11" fill="#5F5A73">
          {dateShort(mid.date)}
        </text>
      )}
      <text x="790" y="252" textAnchor="end" fontSize="11" fill="#5F5A73">
        {a.phase === "ENDED" ? "Event day" : "Today"}
      </text>
    </svg>
  );
}

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/analytics`);
  const owned = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, select: { id: true } });
  if (!owned) notFound();
  const a = await eventAnalytics(id);
  const s = a.summary;
  const maxSource = Math.max(1, ...a.sources.map((x) => x.count));
  const sourceTotal = a.sources.reduce((t, x) => t + x.count, 0);

  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-10 px-4 pb-[72px] pt-2 sm:px-8">
      <section aria-label="Summary" className="grid border-b border-line2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
        <div className="flex flex-col gap-0.5 py-6 pr-6">
          <div className="text-muted">Gross sales</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{birr(a.gross)}</div>
          <div className="text-sm text-muted">
            {n(a.orders)} orders{a.orders ? ` · ${birr(a.avgOrder)} average` : ""}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-line2 p-6 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Your payout</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{birr(a.net)}</div>
          <div className="text-sm text-muted">After {birr(a.fees)} in fees (5%)</div>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-line2 p-6 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Tickets sold</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">
            {n(s.sold)} <span className="text-xl font-semibold text-muted">/ {n(s.totalQuantity)}</span>
          </div>
          <div className="text-sm text-muted">
            {s.soldPct}% of tickets · {n(s.totalQuantity - s.sold)} left
          </div>
        </div>
        <div className="flex flex-col gap-0.5 border-l border-line2 p-6 max-md:border-l-0 max-md:pl-0">
          <div className="text-muted">Page views that became orders</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{a.conversion}%</div>
          <div className="text-sm text-muted">
            {n(a.completed)} orders from {n(a.views)} views
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">Tickets sold since launch</h2>
          {a.projected ? <span className="text-muted">At this pace you sell out around {dateShort(a.projected)}</span> : s.soldOut ? <span className="font-semibold text-primary-dark">Sold out</span> : null}
        </div>
        <div className="rounded-2xl border border-line bg-white px-5 pb-3 pt-5">{a.series.length > 0 && a.summary.sold > 0 ? <Cumulative a={a} /> : <p className="py-10 text-center text-muted">The chart appears after your first sale.</p>}</div>
      </section>

      <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
        <section className="flex min-w-0 flex-[1.4_1_520px] flex-col gap-3">
          <h2 className="h2">By ticket type</h2>
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
                        {t.name}
                        {t.sold >= t.quantity && t.quantity > 0 && <span className="ml-1.5 rounded-md bg-ink px-2 py-0.5 text-xs text-white">Sold out</span>}
                      </div>
                      <div className="text-sm text-muted">{t.kind === "FREE" ? "Free" : birr(t.price)}</div>
                    </td>
                    <td>
                      <div className="text-sm font-semibold">
                        {n(t.sold)} / {n(t.quantity)}
                      </div>
                      <div className="meter mt-1.5">
                        <span style={{ width: `${pct(t.sold, t.quantity)}%` }} />
                      </div>
                    </td>
                    <td className="text-right font-semibold whitespace-nowrap">{birr(t.gross)}</td>
                  </tr>
                ))}
                <tr className="!border-t-2 !border-ink">
                  <td className="font-bold">Total</td>
                  <td className="font-bold">
                    {n(s.sold)} / {n(s.totalQuantity)}
                  </td>
                  <td className="text-right font-bold whitespace-nowrap">{birr(a.gross)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="h2">Where buyers came from</h2>
            <span className="text-sm text-muted">{n(sourceTotal)} orders</span>
          </div>
          {a.sources.length === 0 ? (
            <p className="text-muted">No orders yet.</p>
          ) : (
            <div className="grid items-center gap-x-3 gap-y-3" style={{ gridTemplateColumns: "130px minmax(0,1fr) 76px" }}>
              {a.sources.map((src) => (
                <div key={src.key} className="contents">
                  <div className="font-semibold">{src.label}</div>
                  <div className="h-4">
                    <div className="h-full rounded-r bg-primary" style={{ width: `${(src.count / maxSource) * 100}%` }} />
                  </div>
                  <div className="text-right">
                    <strong>{n(src.count)}</strong> <span className="text-muted">{pct(src.count, sourceTotal)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="m-0 text-sm text-muted">Share your link with a channel tag (WhatsApp, Instagram) from the Overview tab to see it here.</p>
        </section>
      </div>

      <section className="flex flex-col gap-3.5">
        <h2 className="h2">From page view to order</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-[22px] py-5">
            <div className="text-muted">Viewed the event page</div>
            <div className="font-display text-[30px] font-bold tracking-[-0.03em]">{n(a.views)}</div>
            <div className="mt-1.5 h-2 rounded bg-primary" />
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-[22px] py-5">
            <div className="text-muted">Started checkout</div>
            <div className="font-display text-[30px] font-bold tracking-[-0.03em]">
              {n(a.started)} <span className="text-base font-semibold text-muted">{a.startedRate}% of views</span>
            </div>
            <div className="mt-1.5 h-2 rounded bg-line">
              <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, a.startedRate)}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-[22px] py-5">
            <div className="text-muted">Completed an order</div>
            <div className="font-display text-[30px] font-bold tracking-[-0.03em]">
              {n(a.completed)} <span className="text-base font-semibold text-muted">{a.completionRate}% of checkouts</span>
            </div>
            <div className="mt-1.5 h-2 rounded bg-line">
              <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, a.conversion)}%` }} />
            </div>
          </div>
        </div>
        <div className="text-muted">{n(a.abandoned)} people started checkout and left.</div>
      </section>
    </main>
  );
}
