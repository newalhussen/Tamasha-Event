"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "", label: "Overview" },
  { key: "/tickets", label: "Tickets" },
  { key: "/attendees", label: "Attendees" },
  { key: "/analytics", label: "Analytics" },
  { key: "/settings", label: "Settings" },
];

export function EventTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/organizer/events/${id}`;
  return (
    <nav aria-label="Event sections" className="flex flex-wrap gap-1">
      {TABS.map((t) => {
        const href = base + t.key;
        const active = t.key === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-12 items-center px-3.5 no-underline ${active ? "font-bold text-ink shadow-[inset_0_-3px_0_#15121F]" : "font-semibold text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
