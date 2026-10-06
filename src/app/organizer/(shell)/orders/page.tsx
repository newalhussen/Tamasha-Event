import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { RefundDecision } from "@/components/organizer/refund-decision";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYMENT_LABEL } from "@/lib/enums";
import { birr, dateTime, waiting } from "@/lib/format";

export const metadata: Metadata = { title: "Orders" };
const PAGE = 15;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const user = await requirePage(["ORGANIZER"], "/organizer/orders");
  const orgId = user.organizer!.id;
  const where = { event: { organizerId: orgId }, status: { in: ["PAID", "REFUNDED"] } };

  const [orders, total, requests] = await Promise.all([
    db.order.findMany({
      where,
      include: { event: { select: { title: true, id: true } }, _count: { select: { tickets: true } } },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.order.count({ where }),
    db.refundRequest.findMany({
      where: { status: "PENDING", order: { event: { organizerId: orgId } } },
      include: { order: { include: { event: true, _count: { select: { tickets: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <OrganizerHeader user={user} current="orders" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-4 pb-[72px] pt-8 sm:px-8">
        <h1 className="h-display text-[clamp(30px,4vw,40px)]">Orders</h1>

        <section id="refunds" className="flex scroll-mt-6 flex-col">
          <div className="sec-head">
            <h2 className="h2">Refund requests</h2>
            <span className="text-muted">{requests.length === 0 ? "Nothing waiting" : `${requests.length} waiting`}</span>
          </div>
          {requests.length === 0 && <p className="py-4 text-muted">When someone asks for a refund after the refund window, it appears here for you to approve or decline.</p>}
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line2 py-3.5">
              <div className="min-w-[260px] flex-1">
                <div className="font-bold">
                  {r.order.name} · {r.order._count.tickets} {r.order._count.tickets === 1 ? "ticket" : "tickets"} · {birr(r.order.total)}
                </div>
                <div className="text-sm text-muted">
                  {r.order.event.title} · Order #{r.order.code} · waiting {waiting(r.createdAt)}
                  {r.reason ? ` · “${r.reason}”` : ""}
                </div>
              </div>
              <RefundDecision requestId={r.id} />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="h2">All orders</h2>
          <div className="table-card">
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Event</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Paid with</th>
                  <th scope="col" className="text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="mono text-[13px]">#{o.code}</div>
                      <div className="text-[13px] text-muted">{o.paidAt ? dateTime(o.paidAt) : ""}</div>
                    </td>
                    <td>
                      <div className="font-semibold">{o.name}</div>
                      <div className="text-[13px] text-muted">{o.email}</div>
                    </td>
                    <td>
                      <Link href={`/organizer/events/${o.event.id}/attendees`} className="font-semibold text-ink no-underline hover:underline">
                        {o.event.title}
                      </Link>
                    </td>
                    <td>{o._count.tickets}</td>
                    <td>{o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : "—"}</td>
                    <td className="text-right font-semibold whitespace-nowrap">
                      {o.status === "REFUNDED" ? <span className="badge badge-danger">Refunded</span> : o.total === 0 ? "Free" : birr(o.total)}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted">
                      No orders yet. They'll appear as soon as someone buys a ticket.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
              <span>
                Page {page} of {pages} · {total} orders
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={`/organizer/orders?page=${page - 1}`} className="btn">
                    Previous
                  </Link>
                ) : (
                  <span className="btn" aria-disabled="true">
                    Previous
                  </span>
                )}
                {page < pages ? (
                  <Link href={`/organizer/orders?page=${page + 1}`} className="btn">
                    Next
                  </Link>
                ) : (
                  <span className="btn" aria-disabled="true">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
