import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { ReportButtons } from "@/components/admin/row-actions";
import { db } from "@/lib/db";
import { ago, dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "OPEN" } = await searchParams;
  const reports = await db.report.findMany({
    where: s === "all" ? {} : { status: s },
    include: { event: { include: { organizer: true } }, reporter: true },
    orderBy: { createdAt: s === "OPEN" ? "asc" : "desc" },
    take: 100,
  });
  const now = new Date();
  return (
    <>
      <AdminChrome current="reports" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <h1 className="h-display text-[clamp(30px,4vw,40px)]">Reports</h1>
        <div className="flex flex-wrap gap-2">
          {[
            ["OPEN", "Open"],
            ["RESOLVED", "Resolved"],
            ["DISMISSED", "Dismissed"],
            ["all", "All"],
          ].map(([k, label]) => (
            <Link key={k} href={`/admin/reports?s=${k}`} className="pill" aria-pressed={s === k}>
              {label}
            </Link>
          ))}
        </div>
        <div className="card divide-y divide-line">
          {reports.map((r) => {
            const stale = r.status === "OPEN" && now.getTime() - r.createdAt.getTime() > 86_400_000;
            return (
              <div key={r.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
                <div className="min-w-[260px] flex-[1_1_320px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-danger">{r.reason}</span>
                    {stale && <span className="badge badge-warn">Older than 24 hours</span>}
                    {r.status !== "OPEN" && <span className="badge badge-neutral">{r.status.toLowerCase()}</span>}
                  </div>
                  <div className="mt-1.5 font-bold">
                    <Link href={`/events/${r.event.slug}`} target="_blank" className="text-ink no-underline hover:underline">
                      {r.event.title}
                    </Link>{" "}
                    <span className="font-normal text-muted">by {r.event.organizer.name}</span>
                  </div>
                  {r.details && <div className="mt-0.5 text-[15px]">“{r.details}”</div>}
                  <div className="mt-1 text-sm text-muted">
                    {r.reporter ? r.reporter.name : "Anonymous"} · {dateTime(r.createdAt)} ({ago(r.createdAt)})
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin?e=${r.eventId}`} className="btn btn-dark">
                    Open in queue
                  </Link>
                  {r.status === "OPEN" && <ReportButtons reportId={r.id} />}
                </div>
              </div>
            );
          })}
          {reports.length === 0 && <p className="m-0 px-5 py-12 text-center text-muted">No reports here.</p>}
        </div>
      </main>
    </>
  );
}
