"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";
import { MAX_PER_ORDER } from "@/lib/enums";
import type { TicketTypeView } from "@/lib/types";
import { birr, dateShort, n, timeLabel } from "@/lib/format";

type Props = {
  eventId: string;
  source: string;
  types: TicketTypeView[];
  refundUntil: string | null;
  salesEnd: string | null;
  startsAt: string;
  canBuy: boolean; // viewer is allowed to purchase (not organizer/admin)
  blockedReason?: string;
};

export function TicketPicker({ eventId, source, types, refundUntil, salesEnd, startsAt, canBuy, blockedReason }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = Object.values(qty).reduce((s, v) => s + v, 0);
  const total = useMemo(
    () =>
      types.reduce((sum, t) => {
        const q = qty[t.id] ?? 0;
        if (!q) return sum;
        if (t.kind === "FREE") return sum;
        if (t.kind === "PWYW") return sum + q * Math.max(t.price, Number(amount[t.id] ?? t.price) || 0);
        return sum + q * t.price;
      }, 0),
    [qty, amount, types],
  );

  const bump = (t: TicketTypeView, by: number) => {
    setError(null);
    setQty((cur) => {
      const now = cur[t.id] ?? 0;
      const next = now + by;
      const totalNow = Object.values(cur).reduce((s, v) => s + v, 0);
      if (next < 0 || next > Math.min(t.left, t.perOrderMax)) return cur;
      if (by > 0 && totalNow >= MAX_PER_ORDER) return cur;
      return { ...cur, [t.id]: next };
    });
  };

  async function checkout() {
    if (count === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const items = types
        .filter((t) => (qty[t.id] ?? 0) > 0)
        .map((t) => ({
          ticketTypeId: t.id,
          quantity: qty[t.id],
          ...(t.kind === "PWYW" ? { amount: Math.round(Math.max(t.price, Number(amount[t.id] ?? t.price) || 0)) } : {}),
        }));
      const res = await api<{ orderId: string }>("/api/holds", { body: { eventId, items, source } });
      router.push(`/checkout/${res.orderId}`);
    } catch (e) {
      const msg = e instanceof ClientError ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      if (e instanceof ClientError && (e.code === "SOLD_OUT" || e.code === "NOT_YET")) router.refresh();
      toast(msg, "error");
      setBusy(false);
    }
  }

  const anyBuyable = types.some((t) => t.state === "ON_SALE" && t.left > 0);

  return (
    <>
      {types.map((t) => {
        const gone = t.state !== "ON_SALE" || t.left <= 0;
        const q = qty[t.id] ?? 0;
        const label = t.state === "ENDED" ? "Sales ended" : t.state === "NOT_YET" ? "Not on sale yet" : "Sold out";
        const priceText = t.kind === "FREE" ? "Free" : t.kind === "PWYW" ? `Pay what you want, from ${birr(t.price)}` : birr(t.price);
        return (
          <div key={t.id} className={`flex items-center justify-between gap-3 border-t border-line py-4 ${gone ? "text-muted" : ""}`}>
            <div className="min-w-0">
              <div className={`font-bold ${gone ? "line-through" : ""}`}>{t.name}</div>
              <div className="text-sm">
                <span className="font-semibold">{priceText}</span>
                {!gone && (
                  <span className={t.left <= 10 ? "font-semibold text-rose-ink" : "text-muted"}>
                    {" "}
                    · {t.left <= 10 ? `Only ${t.left} left` : `${n(t.left)} left`}
                  </span>
                )}
              </div>
              {t.description && !gone && <div className="mt-0.5 text-[13px] text-muted">{t.description}</div>}
              {t.state === "NOT_YET" && t.saleStart && <div className="mt-0.5 text-[13px]">On sale {dateShort(t.saleStart)}, {timeLabel(t.saleStart)}</div>}
              {t.kind === "PWYW" && q > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <label htmlFor={`amt-${t.id}`} className="text-[13px] font-semibold text-ink">
                    Your price (ETB)
                  </label>
                  <input
                    id={`amt-${t.id}`}
                    inputMode="numeric"
                    className="input !h-10 !w-28"
                    value={amount[t.id] ?? String(t.price)}
                    onChange={(e) => setAmount((a) => ({ ...a, [t.id]: e.target.value.replace(/\D/g, "") }))}
                  />
                </div>
              )}
            </div>
            {gone ? (
              <span className="badge badge-neutral">{label}</span>
            ) : canBuy ? (
              <div className="flex flex-none items-center gap-1">
                <button type="button" aria-label={`Remove one ${t.name} ticket`} onClick={() => bump(t, -1)} disabled={q === 0} className="h-11 w-11 rounded-xl border border-line2 bg-white text-xl font-semibold text-ink disabled:opacity-40">
                  −
                </button>
                <span aria-live="polite" className="w-[30px] text-center text-lg font-bold">
                  {q}
                </span>
                <button type="button" aria-label={`Add one ${t.name} ticket`} onClick={() => bump(t, 1)} className="h-11 w-11 rounded-xl border border-ink bg-ink text-xl font-semibold text-white disabled:opacity-40" disabled={q >= Math.min(t.left, t.perOrderMax) || count >= MAX_PER_ORDER}>
                  +
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {canBuy ? (
        <>
          <div className="flex items-baseline justify-between border-t-2 border-ink pb-3.5 pt-[18px]">
            <span className="font-semibold">{count === 0 ? "No tickets selected" : count === 1 ? "1 ticket" : `${count} tickets`}</span>
            <span className="font-display text-[28px] font-bold tracking-[-0.02em]">{total === 0 && count > 0 ? "Free" : birr(total)}</span>
          </div>
          {error && (
            <div role="alert" className="mb-3 rounded-xl border-2 border-danger px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={checkout}
            disabled={count === 0 || busy || !anyBuyable}
            className="btn btn-primary btn-block h-14 rounded-[14px] text-[17px]"
          >
            {busy ? <Spinner /> : null}
            {count === 0 ? "Select tickets to continue" : busy ? "Holding your tickets…" : "Get tickets"}
          </button>
        </>
      ) : (
        <div className="mt-2 rounded-xl bg-bg px-4 py-3 text-sm text-muted">{blockedReason}</div>
      )}

      <div className="flex flex-col gap-1.5 pt-3.5 text-sm text-muted">
        {refundUntil && (
          <div className="flex gap-2">
            <Icon name="check" size={18} stroke={2.4} className="mt-0.5 flex-none text-primary" />
            <span>Full refund until {dateShort(refundUntil)}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Icon name="check" size={18} stroke={2.4} className="mt-0.5 flex-none text-primary" />
          <span>Pay with Telebirr, CBE Birr or card. Tickets are held for 10 minutes.</span>
        </div>
        <div className="flex gap-2">
          <Icon name="clock" size={18} className="mt-0.5 flex-none" />
          <span>
            {salesEnd ? `Sales end ${dateShort(salesEnd)}, ${timeLabel(salesEnd)}.` : `Sales end when the event starts, ${dateShort(startsAt)}.`} Up to {MAX_PER_ORDER} tickets per order.
          </span>
        </div>
      </div>
    </>
  );
}
