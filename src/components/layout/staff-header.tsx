import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { Icon, Logo } from "@/components/ui/icon";
import { initials } from "@/lib/format";
import { UserMenu } from "./user-menu";

type NavItem = { href: string; label: string; badge?: number; match: string };

function Nav({ items, current }: { items: NavItem[]; current: string }) {
  return (
    <nav className="flex flex-[1_1_320px] flex-wrap gap-0.5" aria-label="Main">
      {items.map((i) => {
        const active = current === i.match;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`on-dark flex h-11 items-center gap-2 rounded-[10px] px-3.5 no-underline ${
              active ? "bg-night2 font-bold text-white" : "font-semibold text-soft3 hover:bg-night2/60 hover:text-white"
            }`}
          >
            {i.label}
            {i.badge ? <span className="rounded-full bg-sun px-[7px] py-px text-xs font-bold text-ink">{i.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function OrganizerHeader({ user, current }: { user: CurrentUser; current: "home" | "events" | "orders" | "payouts" }) {
  const org = user.organizer;
  return (
    <header className="bg-night text-white">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/organizer" className="on-dark flex items-center gap-2.5 text-white no-underline hover:text-white">
          <Logo size={28} ink="#FFFFFF" dot="#4B2BFF" />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">tamasha</span>
          <span className="rounded-md bg-night2 px-[7px] py-[3px] font-mono text-[11px] font-semibold text-[#D9D0FF]">ORGANIZER</span>
        </Link>
        {org && (
          <Link href="/organizer/settings" className="on-dark flex h-11 items-center gap-2 rounded-[10px] border border-night3 px-3 font-semibold text-white no-underline hover:bg-night2/60 hover:text-white" title="Organizer profile and payout settings">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-[11px] font-extrabold text-ink">{initials(org.name)}</span>
            {org.name}
            {!org.verified && <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-bold text-warn-ink">Unverified</span>}
          </Link>
        )}
        <Nav
          current={current}
          items={[
            { href: "/organizer", label: "Home", match: "home" },
            { href: "/organizer/events", label: "Events", match: "events" },
            { href: "/organizer/orders", label: "Orders", match: "orders" },
            { href: "/organizer/payouts", label: "Payouts", match: "payouts" },
          ]}
        />
        <Link href="/organizer/events/new" className="btn btn-white on-dark h-11 px-[18px]">
          <Icon name="plus" stroke={2.6} />
          Create event
        </Link>
        <UserMenu
          dark
          name={user.name}
          email={user.email}
          items={[
            { href: "/organizer", label: "Organizer home" },
            { href: "/organizer/settings", label: "Profile and payouts" },
            { href: "/", label: "View public site" },
          ]}
        />
      </div>
    </header>
  );
}

export function AdminHeader({
  user,
  current,
  counts,
}: {
  user: CurrentUser;
  current: "overview" | "events" | "organizers" | "users" | "reports";
  counts: { events: number; organizers: number; reports: number };
}) {
  return (
    <header className="bg-night text-white">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/admin" className="on-dark flex items-center gap-2.5 text-white no-underline hover:text-white">
          <Logo size={28} ink="#FFFFFF" dot="#4B2BFF" />
          <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">tamasha</span>
          <span className="rounded-md bg-pink px-[7px] py-[3px] font-mono text-[11px] font-semibold text-ink">ADMIN</span>
        </Link>
        <Nav
          current={current}
          items={[
            { href: "/admin", label: "Overview", match: "overview" },
            { href: "/admin/events", label: "Events", badge: counts.events, match: "events" },
            { href: "/admin/organizers", label: "Organizers", badge: counts.organizers, match: "organizers" },
            { href: "/admin/users", label: "Users", match: "users" },
            { href: "/admin/reports", label: "Reports", badge: counts.reports, match: "reports" },
          ]}
        />
        <UserMenu dark name={user.name} email={user.email} items={[{ href: "/admin", label: "Admin console" }, { href: "/", label: "View public site" }]} />
      </div>
    </header>
  );
}
