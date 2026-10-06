"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

export function RefundDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"APPROVE" | "DECLINE" | null>(null);

  async function decide(decision: "APPROVE" | "DECLINE") {
    setBusy(decision);
    try {
      await api(`/api/organizer/refunds/${requestId}`, { method: "PATCH", body: { decision } });
      toast(decision === "APPROVE" ? "Refund approved. The tickets are cancelled." : "Request declined");
      router.refresh();
    } catch (e) {
      toast(e instanceof ClientError ? e.message : "Please try again.", "error");
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="btn btn-dark" disabled={!!busy} onClick={() => decide("APPROVE")}>
        {busy === "APPROVE" && <Spinner />}Approve
      </button>
      <button type="button" className="btn" disabled={!!busy} onClick={() => decide("DECLINE")}>
        {busy === "DECLINE" && <Spinner />}Decline
      </button>
    </div>
  );
}
