import Link from "next/link";
import type { EventSummary } from "@/lib/events";
import { birr, timeLabel, where } from "@/lib/format";
import { CoverArt } from "./cover-art";
import { DateBadge } from "./date-badge";

function priceBlock(e: EventSummary) {
  if (e.soldOut) {
    return (
      <>
        <span className="font-bold text-muted line-through">{e.free ? "Free" : birr(e.minPrice)}</span>
        <span className="font-semibold">Join waitlist</span>
      </>
    );
  }
  if (e.free) {
    return (
      <>
        <span className="font-bold">Free</span>
        <span className="text-muted">Registration needed</span>
      </>
    );
  }
  const multi = new Set(e.types.map((t) => t.price)).size > 1;
  const low = e.totalQuantity > 0 && e.left / e.totalQuantity < 0.2 && e.left > 0;
  return (
    <>
      <span className="font-bold">
        {multi ? "From " : ""}
        {birr(e.minPrice)}
      </span>
      {low ? <span className="font-semibold text-hot">{e.left} left</span> : null}
    </>
  );
}

/** Grid card used on discovery. */
export function EventCard({ event, src = "discover" }: { event: EventSummary; src?: string }) {
  const grey = event.soldOut;
  return (
    <Link href={`/events/${event.slug}?src=${src}`} className="flex flex-col gap-3.5 text-ink no-underline hover:text-ink">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-line">
        <CoverArt preset={grey ? "arts" : event.coverPreset} />
        <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-[5px] text-xs font-bold">{event.category}</span>
        {event.soldOut ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink px-3 py-[9px] text-[13px] font-bold uppercase tracking-[0.06em] text-white">Sold out · Waitlist open</div>
        ) : null}
      </div>
      <div className="flex gap-3.5">
        <DateBadge date={event.startsAt} muted={grey} className="self-start" />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h3 className="m-0 font-display text-[19px] font-semibold leading-[1.2] tracking-[-0.015em]">{event.title}</h3>
          <div className="text-sm text-muted">
            {timeLabel(event.startsAt)} · {where(event.venueName, event.venueAddress)}
          </div>
          <div className="mt-1 flex gap-2.5 text-sm">{priceBlock(event)}</div>
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="skeleton aspect-[4/3] rounded-2xl" />
      <div className="flex gap-3">
        <div className="skeleton h-[52px] w-[52px] flex-none rounded-[10px]" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <div className="skeleton h-4" />
          <div className="skeleton h-3 w-[70%]" />
          <div className="skeleton h-3 w-[40%]" />
        </div>
      </div>
    </div>
  );
}
