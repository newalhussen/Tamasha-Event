"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { initials } from "@/lib/format";

type Item = { href: string; label: string };

/** Avatar button + account dropdown. `dark` styles it for the organizer/admin bars. */
export function UserMenu({ name, email, items, dark = false }: { name: string; email: string; items: Item[]; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Account: ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`on-dark flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${
          dark ? "border border-night3 bg-night2" : "border-0 bg-ink"
        }`}
      >
        {initials(name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[52px] z-50 w-64 overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[0_16px_40px_rgba(21,18,31,0.18)]">
          <div className="border-b border-line px-4 py-3">
            <div className="font-bold">{name}</div>
            <div className="truncate text-sm text-muted">{email}</div>
          </div>
          {items.map((i) => (
            <Link key={i.href + i.label} href={i.href} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-11 items-center px-4 font-semibold text-ink no-underline hover:bg-bg hover:text-ink">
              {i.label}
            </Link>
          ))}
          <button type="button" role="menuitem" onClick={signOut} className="flex min-h-11 w-full items-center border-0 border-t border-line bg-transparent px-4 text-left font-semibold text-danger hover:bg-bg">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
