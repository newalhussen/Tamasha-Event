"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Icon } from "@/components/ui/icon";

/** Native <select> styled as the design's dropdown buttons; navigates by rewriting the query string. */
export function QuerySelect({
  param,
  value,
  options,
  label,
  current,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  return (
    <>
      <label htmlFor={`sel-${param}`} className="sr-only">
        {label}
      </label>
      <select
        id={`sel-${param}`}
        className="select-btn"
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams();
          for (const [k, v] of Object.entries(current)) if (v && k !== "limit") sp.set(k, v);
          if (e.target.value) sp.set(param, e.target.value);
          else sp.delete(param);
          router.push(`/?${sp.toString()}`);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

/** "Pick dates" popover: a tiny GET form so it works without client state. */
export function DateRangePicker({ current, active }: { current: Record<string, string | undefined>; active: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <details ref={ref} className="relative">
      <summary
        className={`pill pill-dashed cursor-pointer list-none [&::-webkit-details-marker]:hidden ${active ? "!border-solid !border-ink !bg-ink !text-white" : ""}`}
      >
        <Icon name="calendar" />
        {active && current.from ? `${current.from}${current.to && current.to !== current.from ? ` → ${current.to}` : ""}` : "Pick dates"}
      </summary>
      <form action="/" method="get" className="absolute left-0 top-12 z-30 flex w-[min(320px,90vw)] flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_16px_40px_rgba(21,18,31,0.18)]">
        {Object.entries(current)
          .filter(([k, v]) => v && !["when", "from", "to", "limit"].includes(k))
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <input type="hidden" name="when" value="range" />
        <div className="field">
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" required min={today} defaultValue={current.from} className="input !h-11" />
        </div>
        <div className="field">
          <label className="label" htmlFor="to">
            To (optional)
          </label>
          <input id="to" name="to" type="date" min={today} defaultValue={current.to} className="input !h-11" />
        </div>
        <button type="submit" className="btn btn-dark">
          Show events
        </button>
      </form>
    </details>
  );
}
