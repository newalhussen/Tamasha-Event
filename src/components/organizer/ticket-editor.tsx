"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateTimeField, type DT } from "@/components/ui/datetime";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";
import { FEE_RATE, MAX_PER_ORDER } from "@/lib/enums";
import { birr, dateShort, fromInputParts, n, timeLabel, toInputParts } from "@/lib/format";

export type EditorType = {
  id: string;
  name: string;
  kind: string;
  price: number;
  quantity: number;
  sold: number;
  held: number;
  description: string;
  perOrderMax: number;
  saleStart: string | null;
  saleEnd: string | null;
};

type Draft = {
  id: string | "new";
  name: string;
  kind: "PAID" | "FREE" | "PWYW";
  price: string;
  quantity: string;
  description: string;
  perOrderMax: number;
  saleStart: DT;
  saleEnd: DT;
};

const QUICK: Record<string, Partial<Draft>> = {
  VIP: { name: "VIP", price: "3000", quantity: "40", description: "Reserved seating and a welcome drink" },
  Student: { name: "Student", price: "600", quantity: "50", description: "Student ID checked at the gate" },
  "Early Bird": { name: "Early Bird", price: "800", quantity: "100", description: "" },
};

const toDraft = (t: EditorType): Draft => ({
  id: t.id,
  name: t.name,
  kind: t.kind as Draft["kind"],
  price: String(t.price),
  quantity: String(t.quantity),
  description: t.description,
  perOrderMax: t.perOrderMax,
  saleStart: toInputParts(t.saleStart),
  saleEnd: toInputParts(t.saleEnd),
});

const blank = (over: Partial<Draft> = {}): Draft => ({
  id: "new",
  name: "",
  kind: "PAID",
  price: "",
  quantity: "",
  description: "",
  perOrderMax: MAX_PER_ORDER,
  saleStart: { date: "", time: "" },
  saleEnd: { date: "", time: "" },
  ...over,
});

const iso = (d: DT) => (d.date ? (fromInputParts(d.date, d.time || "00:00")?.toISOString() ?? null) : null);

/** Ticket types for one event: add, edit, price, capacity. Saves each ticket straight to the API. */
export function TicketEditor({ eventId, capacity, types }: { eventId: string; capacity: number; types: EditorType[] }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allocated = types.reduce((s, t) => s + t.quantity, 0);
  const pctAlloc = capacity ? Math.min(100, Math.round((allocated / capacity) * 100)) : 0;

  function open(d: Draft) {
    setDraft(d);
    setErrors({});
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErrors({});
    setError(null);
    const body = {
      name: draft.name,
      kind: draft.kind,
      price: draft.kind === "FREE" ? 0 : Number(draft.price.replace(/[^\d]/g, "") || 0),
      quantity: Number(draft.quantity.replace(/[^\d]/g, "") || 0),
      description: draft.description || undefined,
      perOrderMax: draft.perOrderMax,
      saleStart: iso(draft.saleStart),
      saleEnd: iso(draft.saleEnd),
    };
    try {
      if (draft.id === "new") await api(`/api/organizer/events/${eventId}/tickets`, { body });
      else await api(`/api/organizer/events/${eventId}/tickets/${draft.id}`, { method: "PATCH", body });
      toast(draft.id === "new" ? "Ticket added" : "Ticket updated");
      setDraft(null);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) {
        setErrors(e.fields);
        if (!Object.keys(e.fields).length) setError(e.message);
      } else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/organizer/events/${eventId}/tickets/${id}`, { method: "DELETE", body: {} });
      toast("Ticket deleted");
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Couldn't delete that.");
    } finally {
      setBusy(false);
    }
  }

  const price = Number(draft?.price.replace(/[^\d]/g, "") || 0);
  const net = Math.round(price * (1 - FEE_RATE));

  return (
    <div className="flex flex-col gap-6">
      {capacity > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-between gap-3 text-sm">
            <span>
              <strong>{n(allocated)}</strong> of {n(capacity)} venue capacity allocated
            </span>
            <span className={allocated > capacity ? "font-semibold text-danger" : "text-muted"}>
              {allocated > capacity ? `${n(allocated - capacity)} over capacity` : `${n(capacity - allocated)} unallocated`}
            </span>
          </div>
          <div role="img" aria-label={`${allocated} of ${capacity} capacity allocated`} className="h-2 rounded bg-line">
            <div className="h-full rounded bg-ink" style={{ width: `${pctAlloc}%` }} />
          </div>
        </div>
      )}
      {capacity === 0 && <div className="rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">Set your venue capacity in “When and where” so we can stop you overselling.</div>}

      {types.map((t) =>
        draft?.id === t.id ? null : (
          <div key={t.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-white px-5 py-[18px]">
            <div className="min-w-[220px] flex-[1_1_220px]">
              <div className="text-[17px] font-bold">{t.name}</div>
              <div className="text-sm text-muted">
                {t.saleStart ? `On sale ${dateShort(t.saleStart)}, ${timeLabel(t.saleStart)}` : "On sale when published"}
                {t.saleEnd ? ` · ends ${dateShort(t.saleEnd)}` : " · ends when the event starts"}
                {t.sold > 0 ? ` · ${n(t.sold)} sold` : ""}
              </div>
            </div>
            <div className="font-bold">{t.kind === "FREE" ? "Free" : t.kind === "PWYW" ? `From ${birr(t.price)}` : birr(t.price)}</div>
            <div className="text-muted">{n(t.quantity)} tickets</div>
            <button type="button" className="btn" onClick={() => open(toDraft(t))}>
              Edit
            </button>
          </div>
        ),
      )}

      {draft && (
        <div className="flex flex-col gap-[22px] rounded-2xl border-2 border-primary bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="h2">{draft.name || "New ticket"}</h2>
            <div role="radiogroup" aria-label="Ticket kind" className="flex rounded-xl bg-neutral p-1">
              {(
                [
                  ["PAID", "Paid"],
                  ["FREE", "Free"],
                  ["PWYW", "Pay what you want"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={draft.kind === k}
                  onClick={() => setDraft({ ...draft, kind: k })}
                  className={`h-10 rounded-[9px] border-0 px-4 ${draft.kind === k ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(21,18,31,0.15)]" : "bg-transparent font-semibold text-neutral-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
            <Field label="Ticket name" error={errors.name}>
              {(p) => <input {...p} className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />}
            </Field>
            {draft.kind !== "FREE" && (
              <Field label={draft.kind === "PWYW" ? "Minimum price" : "Price buyers pay"} error={errors.price}>
                {(p) => (
                  <div className={`flex h-[52px] items-center overflow-hidden rounded-xl bg-white ${errors.price ? "border-2 border-danger" : "border border-field"}`}>
                    <span className="flex h-full items-center border-r border-line bg-bg px-3 font-semibold text-muted">ETB</span>
                    <input {...p} inputMode="numeric" className="h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 font-semibold" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d]/g, "") })} />
                  </div>
                )}
              </Field>
            )}
            <Field label="How many" error={errors.quantity}>
              {(p) => <input {...p} inputMode="numeric" className="input font-semibold" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value.replace(/[^\d]/g, "") })} />}
            </Field>
          </div>

          {draft.kind === "PAID" && price > 0 && (
            <div className="rounded-xl bg-bg px-4 py-3.5">
              You receive <strong>{birr(net)}</strong> per ticket after the {Math.round(FEE_RATE * 100)}% Tamasha fee. Buyers see one all-in price.
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer list-none pb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5">
                More options · {draft.description || draft.saleStart.date || draft.saleEnd.date || draft.perOrderMax !== MAX_PER_ORDER ? "customised" : "using defaults"}
                <Icon name="down" size={14} stroke={2.4} className="transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-line pt-4">
              <Field label="What's included" error={errors.description} hint="Shown under the ticket name on your event page.">
                {(p) => <input {...p} className="input" maxLength={160} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}
              </Field>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
                <DateTimeField label="Sales open" optional value={draft.saleStart} onChange={(v) => setDraft({ ...draft, saleStart: v })} error={errors.saleStart} hint="Leave empty to open when published." />
                <DateTimeField label="Sales close" optional value={draft.saleEnd} onChange={(v) => setDraft({ ...draft, saleEnd: v })} error={errors.saleEnd} hint="Leave empty to close when the event starts." />
              </div>
              <Field label="Per order">
                {(p) => (
                  <select {...p} className="input max-w-[220px]" value={draft.perOrderMax} onChange={(e) => setDraft({ ...draft, perOrderMax: Number(e.target.value) })}>
                    {Array.from({ length: MAX_PER_ORDER }, (_, i) => i + 1).map((i) => (
                      <option key={i} value={i}>
                        1 to {i}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </details>

          <FormError message={error} />
          <div className="flex flex-wrap justify-between gap-3">
            {draft.id !== "new" ? (
              <button type="button" className="btn btn-link !text-danger" onClick={() => remove(draft.id)} disabled={busy}>
                Delete ticket
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn btn-md" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-dark btn-md" onClick={save} disabled={busy}>
                {busy && <Spinner />}Done
              </button>
            </div>
          </div>
        </div>
      )}

      {!draft && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className="btn h-[52px] rounded-[14px] border-[1.5px] border-dashed border-[#6E6890] bg-transparent px-5 font-bold" onClick={() => open(blank())}>
            <Icon name="plus" stroke={2.6} />
            Add ticket type
          </button>
          <span className="text-muted">Quick add:</span>
          {Object.keys(QUICK).map((k) => (
            <button key={k} type="button" className="pill" onClick={() => open(blank(QUICK[k]))}>
              {k}
            </button>
          ))}
        </div>
      )}
      {!draft && <FormError message={error} />}
    </div>
  );
}
