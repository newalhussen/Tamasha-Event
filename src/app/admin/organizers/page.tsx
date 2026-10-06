import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { OrganizerReview } from "@/components/admin/organizer-review";
import { orgInfo } from "@/lib/admin-view";
import { db } from "@/lib/db";
import { dateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Organizers" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "PENDING", label: "Awaiting verification" },
  { key: "VERIFIED", label: "Verified" },
  { key: "SUSPENDED", label: "Suspended" },
];

export default async function AdminOrganizers({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "all" } = await searchParams;
  const rows = await db.organizer.findMany({
    where: s === "all" ? {} : { status: s },
    include: { user: true, _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <AdminChrome current="organizers" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <h1 className="h-display text-[clamp(30px,4vw,40px)]">Organizers</h1>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/admin/organizers" : `/admin/organizers?s=${f.key}`} className="pill" aria-pressed={s === f.key}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="table-card">
          <table style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">Organizer</th>
                <th scope="col">Status</th>
                <th scope="col">Payout</th>
                <th scope="col">Events</th>
                <th scope="col">Joined</th>
                <th scope="col" className="text-right">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="font-bold">{o.name}</div>
                    <div className="text-sm text-muted">{o.user.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${o.status === "SUSPENDED" ? "badge-danger" : o.verified ? "badge-tint" : "badge-warn"}`}>{o.status === "SUSPENDED" ? "Suspended" : o.verified ? "Verified" : "Unverified"}</span>
                  </td>
                  <td>{o.payoutAccount ? (o.payoutVerified ? "Verified" : <span className="text-warn-ink">Needs verification</span>) : <span className="text-muted">None</span>}</td>
                  <td>{o._count.events}</td>
                  <td className="text-muted">{dateShort(o.createdAt)}</td>
                  <td className="text-right">
                    <OrganizerReview org={orgInfo(o)} label="Manage" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No organizers here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
