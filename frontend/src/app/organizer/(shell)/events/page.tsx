import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { EventsTable } from "@/components/organizer/bits";
import { apiGet } from "@/lib/server-api";
import type { OrgEventRow } from "@/lib/types";
import { requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Your events" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "On sale" },
  { key: "draft", label: "Drafts" },
  { key: "ended", label: "Ended" },
];

export default async function OrganizerEvents({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "all" } = await searchParams;
  const user = await requirePage(["ORGANIZER"], "/organizer/events");
  const { events: all } = await apiGet<{ events: OrgEventRow[] }>("/organizer/events");
  const rows = all
    .filter((e) => {
      if (f === "live") return e.status === "PUBLISHED" && e.phase !== "ENDED";
      if (f === "draft") return ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(e.status);
      if (f === "ended") return e.phase === "ENDED" || e.status === "CANCELLED";
      return true;
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const count = (key: string) => (key === "all" ? all.length : all.filter((e) => (key === "live" ? e.status === "PUBLISHED" && e.phase !== "ENDED" : key === "draft" ? ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(e.status) : e.phase === "ENDED" || e.status === "CANCELLED")).length);

  return (
    <>
      <OrganizerHeader user={user} current="events" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="h-display text-[clamp(30px,4vw,40px)]">Events</h1>
          <Link href="/organizer/events/new" className="btn btn-dark btn-md">
            Create event
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((x) => (
            <Link key={x.key} href={x.key === "all" ? "/organizer/events" : `/organizer/events?f=${x.key}`} className="pill" aria-pressed={f === x.key}>
              {x.label} <span className="font-medium opacity-70">{count(x.key)}</span>
            </Link>
          ))}
        </div>
        <EventsTable
          rows={rows}
          empty={
            <div className="rounded-[20px] border border-dashed border-field bg-white px-6 py-8">
              <div className="font-display text-2xl font-bold">Nothing here yet</div>
              <p className="mb-4 mt-1 text-muted">Events matching this filter will appear here.</p>
              <Link href="/organizer/events/new" className="btn btn-dark btn-md">
                Create your first event
              </Link>
            </div>
          }
        />
      </main>
    </>
  );
}
