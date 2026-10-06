"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

/** Share + Save buttons in the event title block. */
export function ShareSave({ eventId, title, saved, loggedIn }: { eventId: string; title: string; saved: boolean; loggedIn: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [isSaved, setSaved] = useState(saved);
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  async function toggleSave() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/events/${eventId}/save`, { method: isSaved ? "DELETE" : "POST", body: {} });
      setSaved(!isSaved);
      toast(isSaved ? "Removed from saved events" : "Saved for later");
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Couldn't save that", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={share} className="btn">
        <Icon name="share" />
        Share
      </button>
      <button type="button" onClick={toggleSave} disabled={busy} aria-pressed={isSaved} className="btn">
        <Icon name="bookmark" style={isSaved ? { fill: "currentColor" } : undefined} />
        {isSaved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

/** Records one page view per browser session (feeds organizer analytics). */
export function ViewBeacon({ eventId, source }: { eventId: string; source: string }) {
  useEffect(() => {
    const key = `viewed:${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: count it anyway */
    }
    fetch(`/api/events/${eventId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
      keepalive: true,
    }).catch(() => {});
  }, [eventId, source]);
  return null;
}

export function WaitlistForm({ eventId, ahead, soldCount }: { eventId: string; ahead: number; soldCount: number }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ahead: number }>(`/api/events/${eventId}/waitlist`, { body: { phone } });
      setDone(res.ahead);
    } catch (err) {
      setError(err instanceof ClientError ? (err.fields.phone ?? err.message) : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 border-t border-line pt-5">
      <div className="flex items-center gap-2.5">
        <span className="badge badge-night">Sold out</span>
        <span className="text-muted">All {soldCount} tickets are gone</span>
      </div>
      <div className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">Join the waitlist</div>
      <div className="text-muted">If someone asks for a refund, we'll text the next person in line. You get 20 minutes to buy.</div>
      {done !== null ? (
        <div role="status" className="rounded-xl bg-tint px-4 py-3 font-semibold text-primary-dark">
          You're on the list. {done} {done === 1 ? "person is" : "people are"} ahead of you.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <Field label="Mobile number" error={error ?? undefined}>
            {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="0911 234 567" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <button type="submit" disabled={busy} className="btn btn-primary btn-block h-14 rounded-[14px] text-[17px]">
            {busy && <Spinner />}Join waitlist
          </button>
          <div className="text-sm text-muted">{ahead} {ahead === 1 ? "person is" : "people are"} waiting</div>
        </form>
      )}
    </div>
  );
}

const REASONS = ["Scam or fraud", "Impersonation", "Inappropriate content", "Wrong information", "Other"] as const;

export function ReportEvent({ eventId }: { eventId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("Scam or fraud");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/events/${eventId}/report`, { body: { reason, details } });
      toast("Thanks. Our team will take a look.");
      setOpen(false);
      setDetails("");
    } catch (err) {
      setError(err instanceof ClientError ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-link btn text-sm !text-muted">
        Report this event
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Report this event">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="What's wrong?">
            {(p) => (
              <select {...p} className="input" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Details (optional)">{(p) => <textarea {...p} rows={3} className="input" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />}</Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-dark">
              {busy && <Spinner />}Send report
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
