"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

const BANKS = ["Commercial Bank of Ethiopia", "Awash Bank", "Dashen Bank", "Bank of Abyssinia", "Wegagen Bank", "Hibret Bank", "Cooperative Bank of Oromia", "Telebirr wallet"];

export function OrganizerSettingsForm({
  initial,
}: {
  initial: { name: string; description: string; payoutBank: string; payoutAccount: string; payoutVerified: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ payoutChanged: boolean }>("/api/organizer/profile", {
        method: "PATCH",
        body: { name: v.name, description: v.description, payoutBank: v.payoutBank || undefined, payoutAccount: v.payoutAccount || "" },
      });
      toast(res.payoutChanged ? "Saved. Your payout account will be re-verified." : "Settings saved");
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
    <form onSubmit={submit} noValidate className="flex max-w-[640px] flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="h2 border-b-2 border-ink pb-2.5">Organizer profile</h2>
        <Field label="Organization name" error={errors.name}>
          {(p) => <input {...p} className="input" value={v.name} onChange={set("name")} />}
        </Field>
        <Field label="About" error={errors.description} hint="Shown on your event pages.">
          {(p) => <textarea {...p} rows={3} className="input" value={v.description} onChange={set("description")} />}
        </Field>
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2.5">
          <h2 className="h2">Payout account</h2>
          {v.payoutAccount && (
            <span className={`badge ${initial.payoutVerified ? "badge-tint" : "badge-warn"}`}>{initial.payoutVerified ? "Verified" : "Waiting for verification"}</span>
          )}
        </div>
        <p className="m-0 text-muted">Paid tickets need a verified payout account. Our team checks new accounts within one working day. Changing the account triggers a fresh check.</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          <Field label="Bank or wallet" error={errors.payoutBank}>
            {(p) => (
              <select {...p} className="input" value={v.payoutBank} onChange={set("payoutBank")}>
                <option value="">Choose…</option>
                {BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Account number" error={errors.payoutAccount}>
            {(p) => <input {...p} inputMode="numeric" className="input" value={v.payoutAccount} onChange={set("payoutAccount")} />}
          </Field>
        </div>
      </section>
      <FormError message={error} />
      <div>
        <button type="submit" disabled={busy} className="btn btn-dark btn-md">
          {busy && <Spinner />}Save changes
        </button>
      </div>
    </form>
  );
}
