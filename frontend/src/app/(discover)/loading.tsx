import { EventCardSkeleton } from "@/components/events/event-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-8" aria-busy="true" aria-label="Loading events">
      <div className="skeleton mb-8 h-12 w-[60%]" />
      <div className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
