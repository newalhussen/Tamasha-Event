"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

/** Name the guest a ticket is for and (optionally) send it to them. */
export function SendToGuest({
  ticketId,
  label,
  className = "btn",
  initialName = "",
  initialContact = "",
}: {
  ticketId: string;
  label: string;
  className?: string;
  initialName?: string;
  initialContact?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState(initialContact);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await api(`/api/tickets/${ticketId}`, { method: "PATCH", body: { holderName: name, holderContact: contact || undefined } });
      toast(contact ? "Ticket sent" : "Guest name saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Send to a guest">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="m-0 text-muted">Put the guest's name on the ticket. Add their email or mobile to send it straight to them.</p>
          <Field label="Guest name" error={errors.holderName}>
            {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
          </Field>
          <Field label="Guest email or mobile (optional)" error={errors.holderContact}>
            {(p) => <input {...p} className="input" value={contact} onChange={(e) => setContact(e.target.value)} />}
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-dark">
              {busy && <Spinner />}Save
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Refund / cancel-registration with a confirmation step. */
export function RefundButton({ orderId, label, free }: { orderId: string; label: string; free: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ refunded: boolean; requested?: boolean }>(`/api/orders/${orderId}/refund`, { body: {} });
      toast(res.refunded ? (free ? "Registration cancelled" : "Refund on its way. Check the Refunded tab.") : "Request sent to the organizer");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={free ? "Cancel registration?" : "Request a refund?"}>
        <p className="m-0 text-muted">
          {free
            ? "Your ticket will stop working and the place goes back to other people."
            : "If you're inside the refund window your tickets are refunded in full straight away and stop working. Otherwise the organizer decides."}
        </p>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Keep my ticket
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={go}>
            {busy && <Spinner />}
            {free ? "Cancel registration" : "Request refund"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

export function AckReschedule({ ticketId, orderId, refundLabel }: { ticketId: string; orderId: string; refundLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"keep" | "refund" | null>(null);

  async function keep() {
    setBusy("keep");
    try {
      await api(`/api/tickets/${ticketId}`, { method: "PATCH", body: { acknowledgeReschedule: true } });
      toast("Great, see you there");
      router.refresh();
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  async function refund() {
    setBusy("refund");
    try {
      await api(`/api/orders/${orderId}/refund`, { body: {} });
      toast("Refund on its way");
      router.refresh();
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={keep} disabled={!!busy} className="btn btn-primary btn-md">
          {busy === "keep" && <Spinner />}Keep my ticket
        </button>
        <button type="button" onClick={refund} disabled={!!busy} className="btn btn-md">
          {busy === "refund" && <Spinner />}I can't make it. Refund me.
        </button>
      </div>
      <div className="text-sm text-muted">{refundLabel}</div>
    </>
  );
}

export function PrintButton({ label, className = "btn" }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
