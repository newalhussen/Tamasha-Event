"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

/** Take a live event down or cancel it (with refunds). */
export function EventTakedown({ eventId, title, canCancel }: { eventId: string; title: string; canCancel: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"UNPUBLISH" | "CANCEL" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/events/${eventId}/moderate`, { body: { action: mode, note: note || undefined } });
      toast(mode === "CANCEL" ? "Event cancelled and everyone refunded" : "Event taken down");
      setMode(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => setMode("UNPUBLISH")}>
          Take down
        </button>
        {canCancel && (
          <button type="button" className="btn btn-danger-outline" onClick={() => setMode("CANCEL")}>
            Cancel
          </button>
        )}
      </div>
      <Dialog open={!!mode} onClose={() => setMode(null)} title={mode === "CANCEL" ? "Cancel and refund everyone?" : "Take this event down?"}>
        <p className="m-0 text-muted">
          <strong className="text-ink">{title}</strong>{" "}
          {mode === "CANCEL" ? "will show as cancelled and every buyer is refunded in full." : "goes back to draft and disappears from discovery. Existing tickets stay valid."}
        </p>
        <Field label="Note for the organizer">{(p) => <textarea {...p} rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}</Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setMode(null)}>
            Keep live
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={go}>
            {busy && <Spinner />}Confirm
          </button>
        </div>
      </Dialog>
    </>
  );
}

export function UserStatusButton({ userId, status, self }: { userId: string; status: string; self: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (self) return <span className="text-sm text-muted">You</span>;
  const suspended = status === "SUSPENDED";
  return (
    <button
      type="button"
      disabled={busy}
      className={`btn ${suspended ? "" : "btn-danger-outline"}`}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/admin/users/${userId}`, { method: "PATCH", body: { status: suspended ? "ACTIVE" : "SUSPENDED" } });
          toast(suspended ? "User reactivated" : "User suspended");
          router.refresh();
        } catch (e) {
          toast(e instanceof ClientError ? e.message : "Couldn't update that user", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Spinner />}
      {suspended ? "Reactivate" : "Suspend"}
    </button>
  );
}

export function ReportButtons({ reportId }: { reportId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function set(status: "RESOLVED" | "DISMISSED") {
    setBusy(status);
    try {
      await api(`/api/admin/reports/${reportId}`, { method: "PATCH", body: { status } });
      toast(status === "RESOLVED" ? "Marked resolved" : "Dismissed");
      router.refresh();
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex gap-2">
      <button type="button" className="btn" disabled={!!busy} onClick={() => set("RESOLVED")}>
        {busy === "RESOLVED" && <Spinner />}Resolve
      </button>
      <button type="button" className="btn" disabled={!!busy} onClick={() => set("DISMISSED")}>
        {busy === "DISMISSED" && <Spinner />}Dismiss
      </button>
    </div>
  );
}
