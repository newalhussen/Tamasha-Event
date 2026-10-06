"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

type Action = "APPROVE" | "REJECT" | "ASK_CHANGES" | "SUSPEND_ORGANIZER";

const DONE: Record<Action, string> = {
  APPROVE: "Approved. The event is live.",
  REJECT: "Listing rejected. The organizer can see your reason.",
  ASK_CHANGES: "Sent back to the organizer for changes.",
  SUSPEND_ORGANIZER: "Organizer suspended and listing rejected.",
};

export function ModerationPanel({ eventId, defaultNote }: { eventId: string; defaultNote: string }) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();

  async function act(action: Action) {
    setBusy(action);
    setError(null);
    setFieldErr(undefined);
    try {
      await api(`/api/admin/events/${eventId}/moderate`, { body: { action, note: action === "APPROVE" ? undefined : note } });
      toast(DONE[action]);
      router.replace("/admin");
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

  const btn = "flex-[1_1_150px] h-12 rounded-xl font-bold";
  return (
    <div className="flex flex-col gap-4">
      <Field label="Reason shown to the organizer" error={fieldErr}>
        {(p) => <textarea {...p} rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
      </Field>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn btn-danger ${btn}`} disabled={!!busy} onClick={() => act("REJECT")}>
          {busy === "REJECT" && <Spinner />}Reject listing
        </button>
        <button type="button" className={`btn btn-danger-outline ${btn}`} disabled={!!busy} onClick={() => act("SUSPEND_ORGANIZER")}>
          {busy === "SUSPEND_ORGANIZER" && <Spinner />}Suspend organizer
        </button>
        <button type="button" className={`btn ${btn} !font-semibold`} disabled={!!busy} onClick={() => act("ASK_CHANGES")}>
          {busy === "ASK_CHANGES" && <Spinner />}Ask for changes
        </button>
        <button type="button" className={`btn ${btn} !font-semibold`} disabled={!!busy} onClick={() => act("APPROVE")}>
          {busy === "APPROVE" && <Spinner />}Approve
        </button>
      </div>
      <div className="text-sm text-muted">Every decision is logged with your name.</div>
    </div>
  );
}
