import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { Icon, Logo } from "@/components/ui/icon";
import { UserMenu } from "./user-menu";

function accountItems(user: CurrentUser) {
  if (user.role === "ADMIN") return [{ href: "/admin", label: "Admin console" }, { href: "/", label: "Browse events" }];
  if (user.role === "ORGANIZER") return [{ href: "/organizer", label: "Organizer home" }, { href: "/", label: "Browse events" }];
  return [{ href: "/tickets", label: "My tickets" }, { href: "/tickets#profile", label: "Profile" }, { href: "/", label: "Browse events" }];
}

export function AuthArea({ user, next }: { user: CurrentUser | null; next?: string }) {
  if (!user) {
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    return (
      <div className="flex items-center gap-2">
        <Link href={`/login${q}`} className="btn border-transparent bg-transparent">
          Sign in
        </Link>
        <Link href="/register" className="btn btn-dark">
          Sign up
        </Link>
      </div>
    );
  }
  return <UserMenu name={user.name} email={user.email} items={accountItems(user)} />;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
      <Logo size={30} />
      <span className="font-display text-2xl font-extrabold tracking-[-0.03em]">tamasha</span>
    </Link>
  );
}

const navLink = "flex h-11 items-center px-3 font-semibold text-ink no-underline hover:text-primary-dark";

/**
 * Attendee-facing top bar.
 * - "discover": brand + city + search + nav (home page)
 * - "default": brand + Browse events / My tickets (event, tickets)
 * - "checkout": brand + slot for the hold timer
 */
export function SiteHeader({
  user,
  variant = "default",
  q,
  current,
  maxWidth = 1240,
  children,
}: {
  user: CurrentUser | null;
  variant?: "discover" | "default" | "checkout";
  q?: string;
  current?: "browse" | "tickets";
  maxWidth?: number;
  children?: React.ReactNode;
}) {
  const hostHref = user?.role === "ORGANIZER" ? "/organizer" : "/register?role=organizer";
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-8" style={{ maxWidth }}>
        <Brand />
        {variant === "discover" && (
          <>
            <span className="flex h-11 items-center gap-2 rounded-xl border border-line2 bg-white px-3.5 font-semibold">
              <Icon name="pin" />
              Addis Ababa
            </span>
            <form action="/" method="get" role="search" className="relative flex min-w-[220px] flex-[1_1_280px] items-center">
              <Icon name="search" size={18} className="absolute left-3.5 text-muted" />
              <label htmlFor="q" className="sr-only">
                Search events
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search events, artists, venues"
                className="h-11 w-full rounded-xl border border-line2 bg-bg pl-[42px] pr-3.5 font-[inherit] text-ink"
              />
            </form>
          </>
        )}
        {variant === "default" && <div className="flex-[1_1_200px]" />}
        {variant === "checkout" ? (
          <>
            <div className="flex-1" />
            {children}
          </>
        ) : (
          <nav className="flex items-center gap-1" aria-label="Main">
            {variant === "default" && (
              <Link href="/" className={navLink} aria-current={current === "browse" ? "page" : undefined}>
                Browse events
              </Link>
            )}
            {(!user || user.role === "ATTENDEE") && (
              <Link
                href="/tickets"
                className={navLink}
                aria-current={current === "tickets" ? "page" : undefined}
                style={current === "tickets" ? { fontWeight: 700, boxShadow: "inset 0 -3px 0 #4B2BFF" } : undefined}
              >
                My tickets
              </Link>
            )}
            {variant === "discover" && (
              <Link href={hostHref} className={navLink}>
                Host an event
              </Link>
            )}
            <AuthArea user={user} />
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-8">
        <span>Prices include all fees. What you see is what you pay.</span>
        <div className="flex flex-wrap gap-5">
          <Link href="/register?role=organizer" className="font-semibold text-ink no-underline">
            Host an event
          </Link>
          <Link href="/" className="font-semibold text-ink no-underline">
            Help
          </Link>
          <Link href="/" className="font-semibold text-ink no-underline">
            Refund policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
