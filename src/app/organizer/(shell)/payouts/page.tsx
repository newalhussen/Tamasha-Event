import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { organizerPayouts } from "@/lib/analytics";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { birr, dateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const user = await requirePage(["ORGANIZER"], "/organizer/payouts");
  const [rows, org] = await Promise.all([organizerPayouts(user.organizer!.id), db.organizer.findUniqueOrThrow({ where: { id: user.organizer!.id } })]);
  const pending = rows.filter((r) => !r.paid && r.event.status === "PUBLISHED");
  const pendingTotal = pending.reduce((s, r) => s + r.net, 0);
  const paidTotal = rows.filter((r) => r.paid).reduce((s, r) => s + r.net, 0);
  const masked = org.payoutAccount ? `${org.payoutBank ?? "Bank"} ending ${org.payoutAccount.slice(-4)}` : null;

  return (
    <>
      <OrganizerHeader user={user} current="payouts" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-8 sm:px-8">
        <h1 className="h-display text-[clamp(30px,4vw,40px)]">Payouts</h1>

        <section className="grid border-b border-line2 border-t-2 border-t-ink" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
          <div className="py-5 pr-6">
            <div className="text-muted">Coming up</div>
            <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{birr(pendingTotal)}</div>
            <div className="text-sm text-muted">After the 5% fee, paid 3 days after each event</div>
          </div>
          <div className="border-l border-line2 px-6 py-5 max-md:border-l-0 max-md:pl-0">
            <div className="text-muted">Paid out so far</div>
            <div className="font-display text-[34px] font-bold tracking-[-0.03em]">{birr(paidTotal)}</div>
          </div>
          <div className="border-l border-line2 px-6 py-5 max-md:border-l-0 max-md:pl-0">
            <div className="text-muted">Payout account</div>
            <div className="text-lg font-bold">{masked ?? "Not added"}</div>
            <div className="text-sm">
              {org.payoutAccount ? (
                org.payoutVerified ? (
                  <span className="font-semibold text-primary-dark">Verified</span>
                ) : (
                  <span className="font-semibold text-warn-ink">Waiting for verification</span>
                )
              ) : null}{" "}
              <Link href="/organizer/settings" className="font-semibold">
                {org.payoutAccount ? "Change" : "Add account"}
              </Link>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="h2">By event</h2>
          <div className="table-card">
            <table style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Gross</th>
                  <th scope="col">Fees (5%)</th>
                  <th scope="col">Your payout</th>
                  <th scope="col" className="text-right">
                    Arrives
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.event.id}>
                    <td>
                      <div className="font-bold">{r.event.title}</div>
                      <div className="text-sm text-muted">{dateShort(r.event.startsAt)}</div>
                    </td>
                    <td>{birr(r.gross)}</td>
                    <td className="text-muted">{birr(r.fees)}</td>
                    <td className="font-semibold">{birr(r.net)}</td>
                    <td className="text-right whitespace-nowrap">
                      {r.event.status === "CANCELLED" ? (
                        <span className="badge badge-neutral">Refunded</span>
                      ) : r.paid ? (
                        <span className="badge badge-tint">Paid {dateShort(r.date)}</span>
                      ) : (
                        <span className="font-semibold">{dateShort(r.date)}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted">
                      Payouts appear once an event is on sale.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
