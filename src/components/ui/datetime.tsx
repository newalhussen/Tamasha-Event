"use client";

import { Field } from "./form";

export type DT = { date: string; time: string };

/** Date + time inputs (Addis Ababa time). Empty date means "not set". */
export function DateTimeField({
  label,
  value,
  onChange,
  error,
  hint,
  optional = false,
  min,
}: {
  label: string;
  value: DT;
  onChange: (v: DT) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  min?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(p) => (
        <div className="flex gap-2">
          <input {...p} type="date" min={min} className="input" value={value.date} onChange={(e) => onChange({ date: e.target.value, time: value.time || "19:00" })} />
          <input
            type="time"
            aria-label={`${label} (time)`}
            className="input !w-[130px] flex-none"
            value={value.time}
            disabled={!value.date}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
          />
          {optional && value.date && (
            <button type="button" className="btn flex-none" onClick={() => onChange({ date: "", time: "" })} aria-label={`Clear ${label}`}>
              Clear
            </button>
          )}
        </div>
      )}
    </Field>
  );
}
