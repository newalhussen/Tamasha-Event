"use client";

import { useId } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
  className?: string;
};

/** Label + control + error/hint, wired for screen readers. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <div id={`${id}-err`} className="field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={`${id}-hint`} className="hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border-2 border-danger bg-white px-4 py-3 font-semibold text-danger">
      {message}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
