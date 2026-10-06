"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";
import { birr, initials } from "@/lib/format";
import { mmss, useCountdown } from "./hold-timer";

type Method = "TELEBIRR" | "CBE_BIRR" | "CARD";

export type CheckoutProps = {
  orderId: string;
  eventId: string;
  eventTitle: string;
  total: number;
  holdExpiresAt: string;
  initialPayError: string | null;
  refundLabel: string | null;
  tickets: { seq: number; typeName: string }[];
  retryItems: { ticketTypeId: string; quantity: number; amount?: number }[];
  user: { name: string; email: string; phone: string } | null;
  next: string;
};

const METHODS: { id: Method; label: string; note?: string }[] = [
  { id: "TELEBIRR", label: "Telebirr", note: "Most used" },
  { id: "CBE_BIRR", label: "CBE Birr" },
  { id: "CARD", label: "Debit or credit card" },
];

export function CheckoutForm(p: CheckoutProps) {
  const router = useRouter();
  const toast = useToast();
  const left = useCountdown(p.holdExpiresAt);
  const [expiredLocal, setExpired] = useState(false);
  const expired = expiredLocal || left === 0;
  const free = p.total === 0;

  const [name, setName] = useState(p.user?.name ?? "");
  const [email, setEmail] = useState(p.user?.email ?? "");
  const [phone, setPhone] = useState(p.user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [guests, setGuests] = useState<{ name: string; contact: string }[]>(p.tickets.slice(1).map(() => ({ name: "", contact: "" })));
  const [method, setMethod] = useState<Method>("TELEBIRR");
  const [payPhone, setPayPhone] = useState(p.user?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payError, setPayError] = useState<string | null>(p.initialPayError);
  const [busy, setBusy] = useState(false);
  const [rehold, setRehold] = useState(false);

  async function pay(overrideMethod?: Method) {
    if (busy || expired) return;
    const m = overrideMethod ?? method;
    setBusy(true);
    setErrors({});
    setPayError(null);
    try {
      await api(`/api/orders/${p.orderId}/pay`, {
        body: {
          name,
          email,
          phone,
          password: password || undefined,
          holders: guests.map((g) => ({ name: g.name, contact: g.contact })),
          method: free ? undefined : m,
          payPhone: free || m === "CARD" ? undefined : payPhone || phone,
        },
      });
      router.push(`/orders/${p.orderId}`);
    } catch (e) {
      if (e instanceof ClientError) {
        if (e.code === "HOLD_EXPIRED") setExpired(true);
        else if (e.code === "PAYMENT_FAILED") setPayError(e.message);
        else if (Object.keys(e.fields).length) {
          setErrors(e.fields);
          document.getElementById("checkout-form")?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
        } else toast(e.message, "error");
      } else toast("Something went wrong. Please try again.", "error");
      setBusy(false);
    }
  }

  async function holdAgain() {
    setRehold(true);
    try {
      const res = await api<{ orderId: string }>("/api/holds", { body: { eventId: p.eventId, items: p.retryItems } });
      router.replace(`/checkout/${res.orderId}`);
      router.refresh();
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Couldn't hold those tickets.", "error");
      setRehold(false);
    }
  }

  if (expired) {
    return (
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5 rounded-[20px] border border-line bg-white p-6">
        <div className="text-lg font-bold">Your 10-minute hold ran out</div>
        <div className="text-muted">Your details are saved on this page. Hold the tickets again to continue, if they're still available.</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={holdAgain} disabled={rehold} className="btn btn-dark btn-md">
            {rehold && <Spinner />}Hold {p.tickets.length} {p.tickets.length === 1 ? "ticket" : "tickets"} again
          </button>
          <Link href="/" className="btn btn-md">
            Back to events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      id="checkout-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        pay();
      }}
      className="m-0 flex min-w-0 flex-[999_1_520px] flex-col gap-9"
    >
      <section className="flex flex-col gap-4">
        <div className="border-b-2 border-ink pb-2.5">
          <h2 className="h2">1. {p.user ? "Your details" : "Where should we send your tickets?"}</h2>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          <Field label="Full name" error={errors.name} className="col-span-full">
            {(f) => <input {...f} className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(f) => <input {...f} type="email" className="input" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!p.user} />}
          </Field>
          <Field label="Mobile number" error={errors.phone}>
            {(f) => <input {...f} type="tel" className="input" autoComplete="tel" inputMode="tel" placeholder="0911 234 567" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          {!p.user && (
            <Field label="Create a password" error={errors.password} hint="So you can open your tickets any time. At least 8 characters." className="col-span-full">
              {(f) => <input {...f} type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
          )}
        </div>
        {errors.email?.includes("already") && (
          <div className="text-sm">
            <Link href={`/login?next=${encodeURIComponent(p.next)}`} className="font-semibold">
              Sign in to continue
            </Link>
          </div>
        )}
        <div className="text-sm text-muted">
          {p.user ? "Tickets appear in My tickets straight after payment." : (
            <>
              Tickets are saved to your new account straight after payment. Already have one? <Link href={`/login?next=${encodeURIComponent(p.next)}`} className="font-semibold">Sign in</Link>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-2.5">
          <h2 className="h2">2. Who's coming?</h2>
          <span className="text-sm text-muted">Optional. You can add names later.</span>
        </div>
        {p.tickets.map((t, i) =>
          i === 0 ? (
            <div key={t.seq} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line2 py-4">
              <div className="w-[150px] flex-none">
                <div className="mono text-xs text-muted">TICKET 1</div>
                <div className="font-bold">{t.typeName}</div>
              </div>
              <div className="flex min-w-[240px] flex-[1_1_240px] items-center gap-2.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{initials(name || "You")}</span>
                <span className="font-semibold">{name || "You"}</span>
                <span className="text-muted">(you)</span>
              </div>
            </div>
          ) : (
            <div key={t.seq} className="flex flex-wrap items-end gap-x-5 gap-y-3 py-4">
              <div className="w-[150px] flex-none pb-1.5">
                <div className="mono text-xs text-muted">TICKET {t.seq}</div>
                <div className="font-bold">{t.typeName}</div>
              </div>
              <Field label="Guest name" className="min-w-[200px] flex-[1_1_200px]">
                {(f) => (
                  <input
                    {...f}
                    className="input"
                    placeholder="Name on the ticket"
                    value={guests[i - 1]?.name ?? ""}
                    onChange={(e) => setGuests((g) => g.map((x, j) => (j === i - 1 ? { ...x, name: e.target.value } : x)))}
                  />
                )}
              </Field>
              <Field label="Guest email or mobile" className="min-w-[200px] flex-[1_1_200px]">
                {(f) => (
                  <input
                    {...f}
                    className="input"
                    placeholder="Send it straight to them"
                    value={guests[i - 1]?.contact ?? ""}
                    onChange={(e) => setGuests((g) => g.map((x, j) => (j === i - 1 ? { ...x, contact: e.target.value } : x)))}
                  />
                )}
              </Field>
            </div>
          ),
        )}
      </section>

      <section className="flex flex-col gap-3.5">
        <div className="border-b-2 border-ink pb-2.5">
          <h2 className="h2">3. {free ? "Confirm" : "Pay"}</h2>
        </div>

        {payError && (
          <div role="alert" className="flex flex-col gap-3 rounded-[20px] border-2 border-danger bg-white p-6">
            <div className="flex items-center gap-2.5 font-bold text-danger">
              <Icon name="alert" size={22} stroke={2.2} />
              {payError}
            </div>
            <div className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">No money was taken</div>
            <div className="text-muted">
              We didn't get a confirmation from your wallet. Your {p.tickets.length} {p.tickets.length === 1 ? "ticket is" : "tickets are"} still held for <span className="mono text-ink">{left === null ? "…" : mmss(left)}</span>.
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => pay()} disabled={busy} className="btn btn-primary btn-md h-[52px]">
                {busy && <Spinner />}Send the prompt again
              </button>
              {method !== "CARD" && (
                <button
                  type="button"
                  onClick={() => {
                    setMethod("CARD");
                    pay("CARD");
                  }}
                  disabled={busy}
                  className="btn h-[52px] px-[18px]"
                >
                  Pay by card instead
                </button>
              )}
            </div>
          </div>
        )}

        {free ? (
          <div className="rounded-2xl border border-line2 bg-white px-5 py-4">
            <div className="font-bold">Free registration</div>
            <div className="text-sm text-muted">No payment needed. Your ticket is issued as soon as you confirm.</div>
          </div>
        ) : (
          <div role="radiogroup" aria-label="Payment method" className="flex flex-col gap-3.5">
            {METHODS.map((m) => {
              const on = method === m.id;
              return (
                <div key={m.id} className={`flex flex-col gap-3.5 rounded-2xl bg-white px-5 py-[18px] ${on ? "border-2 border-primary" : "border border-line2"}`}>
                  <label className="flex min-h-7 items-center gap-3 font-bold">
                    <input type="radio" name="pay" checked={on} onChange={() => setMethod(m.id)} className="m-0 h-5 w-5 accent-primary" />
                    {m.label}
                    {m.note && <span className="ml-auto text-sm font-medium text-muted">{m.note}</span>}
                  </label>
                  {on && m.id !== "CARD" && (
                    <div className="pl-8">
                      <Field label={`${m.label} number`} error={errors.payPhone} hint="We'll send a prompt to this phone. Enter your PIN to confirm.">
                        {(f) => <input {...f} type="tel" inputMode="tel" className="input max-w-[320px]" placeholder="0911 234 567" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />}
                      </Field>
                    </div>
                  )}
                  {on && m.id === "CARD" && <div className="pl-8 text-sm text-muted">You'll confirm your card on our secure payment partner's page. Card details never touch Tamasha.</div>}
                </div>
              );
            })}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary btn-xl btn-block mt-2">
          {busy ? <Spinner size={20} /> : <Icon name="lock" size={18} stroke={2.2} />}
          {busy ? "Processing…" : free ? "Confirm registration" : `Pay ${birr(p.total)}`}
        </button>
        <div className="text-center text-sm text-muted">
          By paying you agree to the ticket terms.{p.refundLabel ? ` ${p.refundLabel}` : ""}
        </div>
      </section>
    </form>
  );
}
