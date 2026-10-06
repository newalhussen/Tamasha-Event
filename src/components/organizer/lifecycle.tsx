"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

type Props = { eventId: string; status: string; ready: boolean; soldCount: number; verified: boolean };

/** Publish / unpublish / cancel / delete controls for one event. */
export function Lifecycle({ eventId, status, ready, soldCount, verified, show = "primary" }: Props & { show?: "primary" | "danger" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);

  async function call(kind: "publish" | "unpublish" | "cancel" | "delete") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "delete") await api(`/api/organizer/events/${eventId}`, { method: "DELETE", body: {} });
      else {
        const res = await api<{ status?: string; refundedOrders?: number }>(`/api/organizer/events/${eventId}/${kind}`, { body: {} });
        if (kind === "publish") toast(res.status === "PUBLISHED" ? "Published. Your event is live." : "Sent for review. We'll publish it as soon as it's approved.", "success");
        if (kind === "unpublish") toast("Event taken off sale");
        if (kind === "cancel") toast(`Event cancelled. ${res.refundedOrders ?? 0} orders refunded.`);
      }
      setConfirm(null);
      if (kind === "delete") router.push("/organizer/events");
      else router.refresh();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (show === "primary") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(status === "DRAFT" || status === "REJECTED") && (
            <button type="button" className="btn btn-primary btn-md" disabled={!ready || !!busy} onClick={() => call("publish")}>
              {busy === "publish" && <Spinner />}
              {verified ? "Publish event" : "Submit for review"}
            </button>
          )}
          {(status === "PUBLISHED" || status === "PENDING_REVIEW") && (
            <button type="button" className="btn btn-md" disabled={!!busy} onClick={() => call("unpublish")}>
              {busy === "unpublish" && <Spinner />}Take off sale
            </button>
          )}
        </div>
        <FormError message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      {status === "DRAFT" || status === "REJECTED" ? (
        <button type="button" className="btn btn-danger-outline self-start" onClick={() => setConfirm("delete")}>
          Delete draft
        </button>
      ) : status !== "CANCELLED" ? (
        <button type="button" className="btn btn-danger-outline self-start" onClick={() => setConfirm("cancel")}>
          Cancel event
        </button>
      ) : (
        <p className="m-0 text-muted">This event is cancelled and every order has been refunded.</p>
      )}
      <Dialog open={confirm === "cancel"} onClose={() => setConfirm(null)} title="Cancel this event?">
        <p className="m-0 text-muted">
          Everyone who bought a ticket ({soldCount} {soldCount === 1 ? "ticket" : "tickets"}) is refunded in full and their tickets stop working. This can't be undone.
        </p>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirm(null)}>
            Keep event
          </button>
          <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => call("cancel")}>
            {busy === "cancel" && <Spinner />}Cancel and refund everyone
          </button>
        </div>
      </Dialog>
      <Dialog open={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete this draft?">
        <p className="m-0 text-muted">The draft and its ticket types are removed permanently.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirm(null)}>
            Keep draft
          </button>
          <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => call("delete")}>
            {busy === "delete" && <Spinner />}Delete draft
          </button>
        </div>
      </Dialog>
    </div>
  );
}
