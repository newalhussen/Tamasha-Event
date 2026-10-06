import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { EventCard } from "@/components/events/event-card";
import { CoverArt } from "@/components/events/cover-art";
import { DateBadge } from "@/components/events/date-badge";
import { DateRangePicker, QuerySelect } from "@/components/events/discover-controls";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/enums";
import { discoverEvents, type PriceFilter, type SortKey, type When } from "@/lib/events";
import { birr, dateShort, dayNum, dow, monthShort, timeLabel, where } from "@/lib/format";

export const dynamic = "force-dynamic";

const WHEN: { key: When; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "This weekend" },
  { key: "week", label: "Next week" },
];
const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "under1000", label: "Under ETB 1,000" },
  { value: "1000to3000", label: "ETB 1,000 – 3,000" },
  { value: "over3000", label: "Over ETB 3,000" },
];
const SORT_OPTIONS = [
  { value: "popular", label: "Sort: Popular" },
  { value: "date", label: "Sort: Soonest" },
  { value: "price", label: "Sort: Price, low to high" },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const when = (one(sp.when) as When | undefined) ?? undefined;
  const cat = one(sp.cat);
  const price = (one(sp.price) as PriceFilter | undefined) ?? undefined;
  const sort = (one(sp.sort) as SortKey | undefined) ?? undefined;
  const from = one(sp.from);
  const to = one(sp.to);
  const limit = Math.min(Math.max(Number(one(sp.limit)) || 8, 8), 60);

  const user = await getCurrentUser();
  const data = await discoverEvents({ q, when, from, to, cat, price, sort, limit });

  const current: Record<string, string | undefined> = { q, when, cat, price, sort, from, to };
  const href = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...over })) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/?${s}` : "/";
  };

  const filtered = !!(q || when || cat || price);
  const heading = q
    ? `Results for “${q}”`
    : data.rangeLabel
      ? data.rangeLabel === "Today" || data.rangeLabel === "Tomorrow"
        ? `${data.rangeLabel} in Addis Ababa`
        : `${data.rangeLabel === "Selected dates" ? "On your dates" : data.rangeLabel} in Addis Ababa`
      : "What’s on in Addis Ababa";
  const span = data.range
    ? (() => {
        const a = data.range.start;
        const b = new Date(data.range.end.getTime() - 1);
        return dayNum(a) === dayNum(b) && monthShort(a) === monthShort(b)
          ? dateShort(a)
          : `${dow(a)} ${dayNum(a)} – ${dow(b)} ${dayNum(b)} ${monthShort(b)}`;
      })()
    : "Upcoming";
  const f = data.featured;
  const showFeature = f && !q && !price && (!cat || cat === "all" || true);

  return (
    <div className="min-h-screen bg-bg text-[15px]">
      <SiteHeader user={user} variant="discover" q={q} />

      <main className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-[72px] pt-10 sm:px-8">
        <section className="flex flex-col gap-[22px]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="h-display text-[clamp(34px,5vw,48px)]">{heading}</h1>
            <div className="text-muted">
              {data.total} {data.total === 1 ? "event" : "events"} · {span}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[52px] text-xs font-bold uppercase tracking-[0.08em] text-muted">When</span>
              {WHEN.map((w) => (
                <Link key={w.key} href={href({ when: when === w.key ? undefined : w.key, from: undefined, to: undefined, limit: undefined })} className="pill" aria-pressed={when === w.key}>
                  {w.label}
                </Link>
              ))}
              <DateRangePicker current={current} active={when === "range"} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[52px] text-xs font-bold uppercase tracking-[0.08em] text-muted">What</span>
              <Link href={href({ cat: undefined, limit: undefined })} className="pill" aria-pressed={!cat || cat === "all"}>
                Everything
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c} href={href({ cat: cat === c ? undefined : c, limit: undefined })} className="pill" aria-pressed={cat === c}>
                  {c}
                </Link>
              ))}
              <div className="ml-auto flex flex-wrap gap-2">
                <QuerySelect param="price" label="Price" value={price ?? ""} options={PRICE_OPTIONS} current={current} />
                <QuerySelect param="sort" label="Sort" value={sort ?? "popular"} options={SORT_OPTIONS} current={current} />
              </div>
            </div>
          </div>
        </section>

        {data.total === 0 ? (
          <section className="flex flex-col gap-3 rounded-[20px] border border-dashed border-field bg-white px-6 py-8">
            <div className="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">{q ? `Nothing for “${q}” ${when === "weekend" ? "this weekend" : "with those filters"}` : "Nothing matches those filters"}</div>
            <div className="text-muted">Try a wider date range, or clear the filters to see everything on in Addis Ababa.</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {when && when !== "all" && (
                <Link href={href({ when: undefined, from: undefined, to: undefined })} className="btn btn-dark btn-md">
                  Show all upcoming dates
                </Link>
              )}
              <Link href="/" className="btn btn-md">
                Clear filters
              </Link>
            </div>
          </section>
        ) : (
          <>
            {showFeature && f && (
              <section className="flex flex-wrap gap-8">
                <Link
                  href={`/events/${f.slug}?src=discover`}
                  className="flex min-w-0 flex-[1.7_1_520px] flex-col overflow-hidden rounded-[20px] border border-line bg-white text-ink no-underline hover:text-ink"
                >
                  <div className="relative h-[340px] overflow-hidden bg-primary">
                    <CoverArt preset={f.coverPreset} text={f.coverText || undefined} textSize={13} />
                    <span className="absolute bottom-5 left-7 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold">{f.category} · Featured</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-5 px-7 py-6">
                    <DateBadge date={f.startsAt} size="lg" />
                    <div className="flex min-w-[240px] flex-[1_1_280px] flex-col gap-1">
                      <h2 className="m-0 font-display text-[30px] font-bold leading-[1.1] tracking-[-0.025em]">{f.title}</h2>
                      <div className="text-muted">
                        {dateShort(f.startsAt)} · {timeLabel(f.startsAt)} · {where(f.venueName, f.venueAddress)} · by {f.organizerName}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="text-lg font-bold">{f.free ? "Free" : `From ${birr(f.minPrice)}`}</div>
                      {f.soldPct >= 50 && <div className="font-semibold text-hot">{f.soldPct}% sold</div>}
                    </div>
                  </div>
                </Link>

                <div className="flex min-w-0 flex-[1_1_340px] flex-col">
                  <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
                    <h2 className="h2">Going fast</h2>
                    <span className="text-sm text-muted">Fewer than 20% of tickets left</span>
                  </div>
                  {data.goingFast.length === 0 && <p className="py-5 text-muted">Nothing is close to selling out right now.</p>}
                  {data.goingFast.map((e) => (
                    <Link key={e.id} href={`/events/${e.slug}?src=discover`} className="flex items-center gap-4 border-b border-line py-[18px] text-ink no-underline hover:text-ink">
                      <DateBadge date={e.startsAt} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold">{e.title}</div>
                        <div className="truncate text-sm text-muted">
                          {timeLabel(e.startsAt)} · {where(e.venueName, e.venueAddress)}
                        </div>
                      </div>
                      <div className="flex-none text-right">
                        <div className="font-bold">{e.free ? "Free" : birr(e.minPrice)}</div>
                        <div className="text-[13px] font-semibold text-hot">{e.left} left</div>
                      </div>
                    </Link>
                  ))}
                  {data.goingFastCount > data.goingFast.length && (
                    <Link href={href({ sort: "date" })} className="py-4 font-semibold no-underline">
                      See all {data.goingFastCount} going fast
                    </Link>
                  )}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.025em]">
                  {sort === "date" ? "Soonest first" : sort === "price" ? "Lowest price first" : data.rangeLabel ? `Popular ${data.rangeLabel.toLowerCase()}` : "Popular right now"}
                </h2>
                <span className="text-sm text-muted">
                  Showing {data.grid.length} of {data.gridTotal}
                </span>
              </div>
              <div className="grid gap-x-6 gap-y-9" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
                {data.grid.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
              {data.gridTotal > data.grid.length && (
                <div className="flex justify-center pt-3">
                  <Link href={href({ limit: String(limit + 8) })} className="btn btn-outline btn-md px-6" scroll={false}>
                    Show {Math.min(8, data.gridTotal - data.grid.length)} more {data.gridTotal - data.grid.length === 1 ? "event" : "events"}
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
        {filtered && data.total > 0 && (
          <div>
            <Link href="/" className="font-semibold">
              Clear all filters
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
