import type { Metadata } from "next";
import Link from "next/link";
import { CoverArt } from "@/components/events/cover-art";
import { QrSvg } from "@/components/tickets/qr";
import { PrintButton, SendToGuest } from "@/components/tickets/ticket-actions";
import { Icon } from "@/components/ui/icon";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import type { EventRecord, OrderRecord, TicketRecord } from "@/lib/types";
import { dateFull, timeLabel, where } from "@/lib/format";

export const metadata: Metadata = { title: "Your ticket" };
export const dynamic = "force-dynamic";

type Ticket = TicketRecord & {
  event: EventRecord;
  order: OrderRecord & { tickets: { code: string; seq: number }[] };
};

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const rawCode = decodeURIComponent(raw);
  const user = await requirePage(["ATTENDEE"], `/tickets/${rawCode}`);
  const { ticket } = await apiGet<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(rawCode)}`);
  const code = ticket.code;

  const e = ticket.event;
  const siblings = ticket.order.tickets;
  const idx = siblings.findIndex((s) => s.code === code);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const cancelled = e.status === "CANCELLED";
  const usable = ticket.status === "VALID" && !cancelled;
  const holder = ticket.holderName || (ticket.seq === 1 ? user.name : "");

  return (
    <div className="min-h-screen bg-night">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-3 px-5 pb-6 pt-8 text-[15px] leading-snug">
        <div className="no-print flex items-center justify-between text-white">
          <Link href="/tickets" aria-label="Back to my tickets" className="on-dark flex h-11 w-11 items-center justify-center rounded-full bg-night2 text-white">
            <Icon name="left" size={20} stroke={2.2} />
          </Link>
          <div className="font-bold">
            Ticket {ticket.seq} of {siblings.length}
          </div>
          <Link href={`/orders/${ticket.orderId}`} aria-label="Order details" className="on-dark flex h-11 w-11 items-center justify-center rounded-full bg-night2 text-white">
            <Icon name="more" size={18} />
          </Link>
        </div>

        <div className="flex flex-col rounded-3xl bg-white text-ink">
          <div className="relative h-[104px] overflow-hidden rounded-t-3xl bg-primary">
            <CoverArt preset={e.coverPreset} text={e.coverText || undefined} textSize={9.5} />
          </div>
          <div className="flex flex-col gap-3 px-5 pb-3.5 pt-4">
            <div>
              <div className="mono text-xs uppercase tracking-[0.04em] text-primary-dark">{ticket.ticketType.name}</div>
              <div className="mt-0.5 font-display text-[23px] font-bold leading-[1.1] tracking-[-0.025em]">{e.title}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div>
                <div className="text-xs text-muted">Date</div>
                <div className="font-bold">{dateFull(e.startsAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Time</div>
                <div className="font-bold">
                  {timeLabel(e.startsAt)}
                  {e.gatesAt ? ` · Gates ${timeLabel(e.gatesAt).replace(" PM", "").replace(" AM", "")}` : ""}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Venue</div>
                <div className="font-bold">{where(e.venueName, e.venueAddress)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Name</div>
                <div className={`font-bold ${holder ? "" : "text-rose-ink"}`}>{holder || "Not named yet"}</div>
              </div>
            </div>
          </div>

          <div className="relative mx-4 h-0 border-t-2 border-dashed border-soft">
            <span className="absolute -left-7 -top-[13px] h-6 w-6 rounded-full bg-night" />
            <span className="absolute -right-7 -top-[13px] h-6 w-6 rounded-full bg-night" />
          </div>

          <div className="flex flex-col items-center gap-2.5 px-5 pb-[18px] pt-5">
            {usable ? (
              <QrSvg value={ticket.code} label={`QR code for ticket ${ticket.code}`} className="h-[180px] w-[180px]" />
            ) : (
              <div className="flex h-[180px] w-[180px] flex-col items-center justify-center gap-2 rounded-xl bg-neutral px-3 text-center">
                <Icon name={ticket.status === "CHECKED_IN" ? "check" : "x"} size={36} stroke={2.4} className={ticket.status === "CHECKED_IN" ? "text-primary" : "text-danger"} />
                <div className="font-bold">
                  {ticket.status === "CHECKED_IN"
                    ? `Checked in${ticket.checkedInAt ? ` at ${timeLabel(ticket.checkedInAt)}` : ""}`
                    : cancelled
                      ? "Event cancelled"
                      : "Refunded"}
                </div>
                <div className="text-xs text-muted">{ticket.status === "CHECKED_IN" ? "This ticket has been used." : "This ticket no longer works."}</div>
              </div>
            )}
            <div className={`mono text-[17px] tracking-[0.06em] ${usable ? "" : "text-muted line-through"}`}>{ticket.code}</div>
            <div className="text-[13px] text-muted">
              Order #{ticket.order.code} · Admits one{e.ageLimit > 0 ? ` · ${e.ageLimit}+ with ID` : ""}
            </div>
          </div>
        </div>

        {siblings.length > 1 && (
          <div className="no-print flex items-center justify-center gap-3 py-1">
            {prev ? (
              <Link href={`/tickets/${prev.code}`} className="on-dark text-sm font-semibold text-white">
                ← Ticket {prev.seq}
              </Link>
            ) : (
              <span className="w-16" />
            )}
            <div className="flex gap-2" aria-hidden="true">
              {siblings.map((s) => (
                <span key={s.code} className={`h-1.5 rounded-[3px] ${s.code === code ? "w-[22px] bg-white" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
            {next ? (
              <Link href={`/tickets/${next.code}`} className="on-dark text-sm font-semibold text-white">
                Ticket {next.seq} →
              </Link>
            ) : (
              <span className="w-16" />
            )}
          </div>
        )}

        {usable && (
          <div className="no-print flex gap-2.5">
            <PrintButton label="Save ticket" className="btn flex-1 !h-[52px] !rounded-[14px] !border-0 !bg-white !font-bold !text-ink" />
            <SendToGuest
              ticketId={ticket.id}
              label={ticket.holderName && ticket.seq > 1 ? "Change guest" : "Send to a guest"}
              className="btn flex-1 !h-[52px] !rounded-[14px] !border-[1.5px] !border-[#6E6890] !bg-transparent !font-bold !text-white"
              initialName={ticket.seq > 1 ? ticket.holderName : ""}
              initialContact={ticket.seq > 1 ? ticket.holderContact : ""}
            />
          </div>
        )}
        <div className="no-print text-center text-[13px] text-soft2">Open this ticket before you leave home, so it's ready at the gate.</div>
      </div>
    </div>
  );
}
