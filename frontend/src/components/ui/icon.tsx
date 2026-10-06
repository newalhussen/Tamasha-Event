import type { SVGProps } from "react";

const PATHS: Record<string, React.ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  down: <path d="M6 9l6 6 6-6" />,
  left: <path d="M15 5l-7 7 7 7" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  share: <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  bookmark: <path d="M6 3h12v18l-6-4.5L6 21z" />,
  scan: <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 12h8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 16h.01" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  bolt: <path d="M13 3L5 13.5h6L11 21l8-10.5h-6z" />,
  id: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <circle cx="9" cy="12" r="2" />
      <path d="M14 10.5h3.5M14 13.5h3.5" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M5 19h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  stroke = 2,
  ...rest
}: { name: IconName; size?: number; stroke?: number } & Omit<SVGProps<SVGSVGElement>, "name" | "stroke" | "size">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The ticket-with-a-dot mark. */
export function Logo({ size = 30, ink = "#4B2BFF", dot = "#FFD84D" }: { size?: number; ink?: string; dot?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <path d="M6 2h18a4 4 0 0 1 4 4v5.5a3.5 3.5 0 0 0 0 7V24a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-5.5a3.5 3.5 0 0 0 0-7V6a4 4 0 0 1 4-4z" fill={ink} />
      <circle cx="15" cy="15" r="4.5" fill={dot} />
    </svg>
  );
}
