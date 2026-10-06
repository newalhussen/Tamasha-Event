"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { api, ClientError } from "@/lib/client";

type Mode = "login" | "register";

export function AuthForm({ mode, next, defaultRole }: { mode: Mode; next?: string; defaultRole?: "ATTENDEE" | "ORGANIZER" }) {
  const router = useRouter();
  const [role, setRole] = useState<"ATTENDEE" | "ORGANIZER">(defaultRole ?? "ATTENDEE");
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "", organizerName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const body =
        mode === "login"
          ? { email: values.email, password: values.password }
          : { ...values, role, organizerName: role === "ORGANIZER" ? values.organizerName : undefined };
      const res = await api<{ home: string; role: string }>(`/api/auth/${mode}`, { body });
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(res.role === "ATTENDEE" ? (safeNext ?? res.home) : (safeNext?.startsWith(res.home) ? safeNext : res.home));
      router.refresh();
    } catch (err) {
      if (err instanceof ClientError) {
        setErrors(err.fields);
        setFormError(Object.keys(err.fields).length ? null : err.message);
      } else setFormError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
      {mode === "register" && (
        <div role="radiogroup" aria-label="Account type" className="flex rounded-xl bg-neutral p-1">
          {(
            [
              ["ATTENDEE", "I want to attend"],
              ["ORGANIZER", "I host events"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={role === v}
              onClick={() => setRole(v)}
              className={`h-10 flex-1 rounded-[9px] border-0 px-3 font-semibold ${role === v ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(21,18,31,0.15)]" : "bg-transparent text-neutral-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "register" && (
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} className="input" autoComplete="name" value={values.name} onChange={set("name")} />}
        </Field>
      )}
      {mode === "register" && role === "ORGANIZER" && (
        <Field label="Organization or brand name" error={errors.organizerName} hint="Shown on your event pages.">
          {(p) => <input {...p} className="input" value={values.organizerName} onChange={set("organizerName")} />}
        </Field>
      )}
      <Field label="Email" error={errors.email}>
        {(p) => <input {...p} type="email" className="input" autoComplete="email" inputMode="email" value={values.email} onChange={set("email")} />}
      </Field>
      {mode === "register" && (
        <Field label="Mobile number (optional)" error={errors.phone}>
          {(p) => <input {...p} type="tel" className="input" autoComplete="tel" placeholder="0911 234 567" value={values.phone} onChange={set("phone")} />}
        </Field>
      )}
      <Field label="Password" error={errors.password} hint={mode === "register" ? "At least 8 characters." : undefined}>
        {(p) => <input {...p} type="password" className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} value={values.password} onChange={set("password")} />}
      </Field>
      <FormError message={formError} />
      <button type="submit" disabled={busy} className="btn btn-primary btn-lg btn-block">
        {busy && <Spinner />}
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
      <div className="text-center text-[15px] text-muted">
        {mode === "login" ? (
          <>
            New to Tamasha? <Link href={`/register${q}`} className="font-semibold">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href={`/login${q}`} className="font-semibold">Sign in</Link>
          </>
        )}
      </div>
    </form>
  );
}
