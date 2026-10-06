"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";

type Prefs = { smsReminder: boolean; emailFollowed: boolean; weeklyPicks: boolean };
type Profile = { name: string; email: string; phone: string; city: string };

export function ProfilePanel({ profile, prefs, organizer }: { profile: Profile; prefs: Prefs; organizer: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: profile.name, phone: profile.phone, city: profile.city });
  const [current, setCurrent] = useState(prefs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: { name: string; phone: string; city: string }, nextPrefs: Prefs) {
    await api("/api/me", { method: "PATCH", body: { name: next.name, phone: next.phone || undefined, city: next.city, prefs: nextPrefs } });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await save(values, current);
      toast("Profile updated");
      setEditing(false);
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

  async function togglePref(key: keyof Prefs) {
    const next = { ...current, [key]: !current[key] };
    setCurrent(next);
    try {
      await save({ name: profile.name, phone: profile.phone, city: profile.city }, next);
    } catch (err) {
      setCurrent(current);
      toast(err instanceof ClientError ? err.message : "Couldn't save that", "error");
    }
  }

  const rows: [string, string][] = [
    ["Name", profile.name],
    ["Email", profile.email],
    ["Mobile", profile.phone || "Not added"],
    ["City", profile.city],
  ];

  return (
    <aside id="profile" aria-label="Profile" className="flex min-w-0 flex-[1_1_300px] scroll-mt-6 flex-col gap-7 pt-2">
      <section className="flex flex-col">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
          <h2 className="h2">Profile</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="btn-link btn !min-h-0 text-[15px]">
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3.5 pt-4">
            <Field label="Name" error={errors.name}>
              {(p) => <input {...p} className="input" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
            </Field>
            <Field label="Mobile" error={errors.phone}>
              {(p) => <input {...p} type="tel" className="input" placeholder="0911 234 567" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />}
            </Field>
            <Field label="City" error={errors.city}>
              {(p) => <input {...p} className="input" value={values.city} onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))} />}
            </Field>
            <FormError message={error} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn btn-dark">
                {busy && <Spinner />}Save
              </button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line2 py-[13px]">
              <span className="text-muted">{k}</span>
              <span className="text-right font-semibold [overflow-wrap:anywhere]">{v}</span>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col">
        <h2 className="h2 border-b-2 border-ink pb-2.5">Reminders</h2>
        {(
          [
            ["smsReminder", "SMS the day before an event"],
            ["emailFollowed", "Email when organizers I follow announce events"],
            ["weeklyPicks", "Weekly picks for Addis Ababa"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line2">
            {label}
            <input type="checkbox" checked={current[key]} onChange={() => togglePref(key)} className="m-0 h-[22px] w-[22px] accent-primary" />
          </label>
        ))}
      </section>

      {organizer && (
        <div className="text-[15px] text-muted">
          Running an event? <a href="/organizer" className="font-semibold">Switch to organizer tools</a>
        </div>
      )}
    </aside>
  );
}
