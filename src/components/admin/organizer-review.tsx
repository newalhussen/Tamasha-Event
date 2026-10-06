"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

export type OrgInfo = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  joined: string;
  events: number;
  status: string;
  verified: boolean;
  payoutBank: string | null;
  payoutAccountMasked: string | null;
  payoutVerified: boolean;
  note: string;
};

type Act = "VERIFY" | "VERIFY_PAYOUT" | "REQUEST_DETAILS" | "SUSPEND" | "REINSTATE";

export function OrganizerReview({ org, label = "Review" }: { org: OrgInfo; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Act | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();

  async function act(action: Act) {
    setBusy(action);
    setError(null);
    setFieldErr(undefined);
    try {
      await api(`/api/admin/organizers/${org.id}`, { method: "PATCH", body: { action, note: note || undefined } });
      toast("Done");
      if (action !== "VERIFY_PAYOUT") setOpen(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientError) {
        setFieldErr(e.fields.note);
        if (!e.fields.note) setError(e.message);
      }
    } finally {
      setBusy(null);
    }
  }

  const rows: [string, React.ReactNode][] = [
    ["Owner", `${org.ownerName} · ${org.ownerEmail}${org.ownerPhone ? ` · ${org.ownerPhone}` : ""}`],
    ["Joined", org.joined],
    ["Events", `${org.events} created`],
    ["Payout", org.payoutAccountMasked ? `${org.payoutBank} ${org.payoutAccountMasked} · ${org.payoutVerified ? "verified" : "not verified"}` : "No payout account added"],
    ["Status", `${org.status.toLowerCase()}${org.verified ? " · verified" : ""}`],
  ];
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={org.name} width={560}>
        <div className="flex flex-col">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 border-t border-line py-2.5">
              <span className="w-20 flex-none text-muted">{k}</span>
              <span className="min-w-0 break-words">{v}</span>
            </div>
          ))}
          {org.note && (
            <div className="flex gap-3 border-y border-line py-2.5">
              <span className="w-20 flex-none text-muted">Last note</span>
              <span>{org.note}</span>
            </div>
          )}
        </div>
        <Field label="Note to the organizer (for requests and suspensions)" error={fieldErr}>
          {(p) => <textarea {...p} rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />}
        </Field>
        <FormError message={error} />
        <div className="flex flex-wrap gap-2">
          {!org.verified && (
            <button type="button" className="btn btn-dark" disabled={!!busy} onClick={() => act("VERIFY")}>
              {busy === "VERIFY" && <Spinner />}Verify organizer
            </button>
          )}
          {org.payoutAccountMasked && !org.payoutVerified && (
            <button type="button" className="btn btn-dark" disabled={!!busy} onClick={() => act("VERIFY_PAYOUT")}>
              {busy === "VERIFY_PAYOUT" && <Spinner />}Verify payout account
            </button>
          )}
          <button type="button" className="btn" disabled={!!busy} onClick={() => act("REQUEST_DETAILS")}>
            {busy === "REQUEST_DETAILS" && <Spinner />}Request details
          </button>
          {org.status === "SUSPENDED" ? (
            <button type="button" className="btn" disabled={!!busy} onClick={() => act("REINSTATE")}>
              {busy === "REINSTATE" && <Spinner />}Reinstate
            </button>
          ) : (
            <button type="button" className="btn btn-danger-outline" disabled={!!busy} onClick={() => act("SUSPEND")}>
              {busy === "SUSPEND" && <Spinner />}Suspend
            </button>
          )}
        </div>
      </Dialog>
    </>
  );
}
