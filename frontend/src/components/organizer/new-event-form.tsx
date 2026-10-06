"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";
import { CATEGORIES } from "@/lib/enums";

export function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ id: string }>("/api/organizer/events", { body: { title, category } });
      router.push(`/organizer/events/${res.id}/edit?step=where`);
    } catch (err) {
      if (err instanceof ClientError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) setError(err.message);
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Event name" error={errors.title}>
        {(p) => <input {...p} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunday Slow Market" autoFocus maxLength={100} />}
      </Field>
      <Field label="Category" error={errors.category}>
        {(p) => (
          <select {...p} className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={busy} className="btn btn-primary btn-lg self-start">
        {busy && <Spinner />}Create draft
      </button>
    </form>
  );
}
