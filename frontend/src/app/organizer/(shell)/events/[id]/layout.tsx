import Link from "next/link";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { EventTabs } from "@/components/organizer/event-tabs";
import { eventStatus } from "@/components/organizer/bits";
import { Icon } from "@/components/ui/icon";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import type { EventDetail } from "@/lib/types";
import { dateShort, daysUntil, timeLabel, where } from "@/lib/format";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}`);
  const { event: e, phase } = await apiGet<EventDetail>(`/organizer/events/${id}`);
  const st = eventStatus({ status: e.status, phase, startsAt: e.startsAt });
  const days = daysUntil(e.startsAt);
  const label = e.status === "PUBLISHED" && phase === "UPCOMING" ? `${st.label} · ${days <= 0 ? "today" : days === 1 ? "tomorrow" : `${days} days to go`}` : st.label;
  const live = e.status === "PUBLISHED";

  return (
    <>
      <OrganizerHeader user={user} current="events" />
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-4 pt-6 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Link href="/organizer/events" className="text-sm font-semibold no-underline">
                ← All events
              </Link>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <h1 className="m-0 font-display text-[clamp(24px,3vw,32px)] font-bold leading-[1.1] tracking-[-0.03em]">{e.title}</h1>
                <span className={`badge ${st.cls}`}>
                  {phase === "LIVE" && e.status === "PUBLISHED" && <span className="h-2 w-2 rounded-full bg-hot" />}
                  {label}
                </span>
              </div>
              <div className="text-muted">
                {dateShort(e.startsAt)} · {timeLabel(e.startsAt)} · {where(e.venueName, e.venueAddress)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/organizer/events/${e.id}/edit`} className="btn btn-md">
                Edit details
              </Link>
              <Link href={`/events/${e.slug}`} target="_blank" className="btn btn-md">
                {live ? "View event page" : "Preview"}
              </Link>
              {live && (
                <Link href={`/organizer/events/${e.id}/scan`} className="btn btn-primary btn-md">
                  <Icon name="scan" size={18} stroke={2.2} />
                  Open door scanner
                </Link>
              )}
            </div>
          </div>
          <EventTabs id={e.id} />
        </div>
      </div>
      {children}
    </>
  );
}
