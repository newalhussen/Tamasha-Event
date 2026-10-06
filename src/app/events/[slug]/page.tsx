import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverArt } from "@/components/events/cover-art";
import { ReportEvent, ShareSave, ViewBeacon, WaitlistForm } from "@/components/events/event-actions";
import { TicketPicker } from "@/components/events/ticket-picker";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPublicEvent } from "@/lib/events";
import { birr, dateLong, dateShort, initials, timeLabel, where } from "@/lib/format";
import { sanitizeSource } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await db.event.findUnique({ where: { slug }, select: { title: true, summary: true, status: true } });
  if (!e || !["PUBLISHED", "CANCELLED"].includes(e.status)) return { title: "Event" };
  return { title: e.title, description: e.summary || undefined };
}

export default async function EventPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ src?: string }> }) {
  const { slug } = await params;
  const { src } = await searchParams;
  const user = await getCurrentUser();
  const data = await getPublicEvent(slug, { organizerId: user?.organizer?.id, admin: user?.role === "ADMIN" });
  if (!data) notFound();
  const { event: e, summary: s, lineup, info, similar, hostedCount } = data;
  const source = sanitizeSource(src);
  const preview = e.status !== "PUBLISHED" && e.status !== "CANCELLED";
  const cancelled = e.status === "CANCELLED";
  const ended = s.phase === "ENDED";
  const live = s.phase === "LIVE";
  const saved = user ? !!(await db.savedEvent.findUnique({ where: { userId_eventId: { userId: user.id, eventId: e.id } } })) : false;
  const waitlist = s.soldOut && !cancelled && !ended ? await db.waitlistEntry.count({ where: { eventId: e.id } }) : 0;
  const canBuy = !user || user.role === "ATTENDEE";
  const blocked = user?.role === "ORGANIZER" ? "You're signed in as an organizer. Use an attendee account to buy tickets." : "You're signed in as an admin. Use an attendee account to buy tickets.";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venueName} ${e.venueAddress} ${e.city}`)}`;
  const endTime = e.endsAt ? timeLabel(e.endsAt) : null;
  const orgInitials = initials(e.organizer.name);

  return (
    <div className="min-h-screen bg-bg text-base leading-normal">
      <SiteHeader user={user} current="browse" />
      {!preview && !cancelled && !ended && <ViewBeacon eventId={e.id} source={source} />}

      <main className="mx-auto max-w-[1240px] px-4 pb-20 pt-6 sm:px-8">
        {preview && (
          <div role="status" className="mb-5 rounded-xl bg-warn-bg px-4 py-3 font-semibold text-warn-ink">
            Preview only. This event is {e.status === "PENDING_REVIEW" ? "waiting for review" : e.status.toLowerCase()} and isn't visible to the public yet.
          </div>
        )}
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-muted">
          <Link href="/" className="text-muted">
            Addis Ababa
          </Link>
          <span>/</span>
          <Link href={`/?cat=${encodeURIComponent(e.category)}`} className="text-muted">
            {e.category}
          </Link>
          <span>/</span>
          <span className="text-ink">{e.title}</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-5 pb-8 pt-6">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3.5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-ink px-3 py-[5px] text-[13px] font-bold text-white">
                {e.category}
                {live ? " · Live now" : ""}
              </span>
              {cancelled && <span className="rounded-full bg-danger px-3 py-[5px] text-[13px] font-bold text-white">Cancelled</span>}
              {!cancelled && !ended && s.soldPct >= 50 && !s.soldOut && <span className="rounded-full bg-rose px-3 py-[5px] text-[13px] font-bold text-rose-ink">{s.soldPct}% sold</span>}
              {s.soldOut && !cancelled && !ended && <span className="rounded-full bg-rose px-3 py-[5px] text-[13px] font-bold text-rose-ink">Sold out</span>}
              {s.rescheduled && !cancelled && <span className="rounded-full bg-warn-bg px-3 py-[5px] text-[13px] font-bold text-warn-ink">New date</span>}
            </div>
            <h1 className={`h-display text-[clamp(38px,6vw,60px)] leading-[0.98] [text-wrap:balance] ${cancelled ? "text-muted line-through" : ""}`}>{e.title}</h1>
            <div className="text-xl font-semibold">
              {dateShort(e.startsAt)} · {timeLabel(e.startsAt)} <span className="font-medium text-muted">· {where(e.venueName, e.venueAddress)}</span>
            </div>
          </div>
          <ShareSave eventId={e.id} title={e.title} saved={saved} loggedIn={!!user} />
        </div>

        <div className="ev-grid">
          <div className="flex min-w-0 flex-col gap-7">
            <div className="relative h-[420px] overflow-hidden rounded-[20px] bg-primary max-sm:h-[280px]">
              <CoverArt preset={cancelled ? "arts" : e.coverPreset} text={e.coverText || undefined} textSize={14} />
              {e.coverText ? <span className="absolute bottom-5 right-6 rounded-md bg-white px-2.5 py-[5px] font-mono text-xs font-semibold">Organizer artwork</span> : null}
            </div>
            <div className="grid gap-6 border-b border-line2 pb-7 pt-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))" }}>
              <div className="flex flex-col gap-1">
                <div className="eyebrow">When</div>
                <div className="text-lg font-bold">{dateLong(e.startsAt)}</div>
                <div className="text-muted">
                  {timeLabel(e.startsAt)}
                  {endTime ? ` – ${endTime}` : ""}
                  {e.gatesAt ? ` · Gates ${timeLabel(e.gatesAt)}` : ""}
                </div>
                {!cancelled && (
                  <a href={`/api/events/${e.id}/calendar`} className="text-[15px] font-semibold">
                    Add to calendar
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <div className="eyebrow">Where</div>
                <div className="text-lg font-bold">{e.venueName}</div>
                <div className="text-muted">{e.venueAddress || e.city}</div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold">
                  Map and directions
                </a>
              </div>
              <div className="flex flex-col gap-1">
                <div className="eyebrow">Know before you book</div>
                <div className="text-lg font-bold">{e.ageLimit > 0 ? `${e.ageLimit}+ · ID at the gate` : "All ages welcome"}</div>
                <div className="text-muted">{e.capacity ? `${e.capacity.toLocaleString("en-US")} capacity` : "Capacity limited"}</div>
                <a href="#info" className="text-[15px] font-semibold">
                  Entry and refund details
                </a>
              </div>
            </div>
          </div>

          <aside className="ev-buy flex flex-col gap-1 rounded-[20px] border border-line bg-white p-6 shadow-[0_12px_32px_rgba(21,18,31,0.08)]" aria-label="Tickets">
            {cancelled ? (
              <div className="flex flex-col gap-3">
                <span className="badge badge-danger self-start">Cancelled</span>
                <div className="font-display text-2xl font-bold leading-tight">The organizer cancelled this event.</div>
                <div className="text-muted">Everyone who bought a ticket has been refunded in full. Refunds reach Telebirr within minutes and cards within 5 working days.</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {user?.role === "ATTENDEE" && (
                    <Link href="/tickets?tab=refunded" className="btn btn-dark btn-md">
                      See my refund
                    </Link>
                  )}
                  <Link href={`/?cat=${encodeURIComponent(e.category)}`} className="btn btn-md">
                    Find similar events
                  </Link>
                </div>
              </div>
            ) : ended ? (
              <div className="flex flex-col gap-2">
                <span className="badge badge-neutral self-start">Ended</span>
                <div className="font-display text-2xl font-bold">This event has finished.</div>
                <Link href="/" className="font-semibold">
                  Browse upcoming events
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between pb-3">
                  <h2 className="m-0 font-display text-2xl font-bold tracking-[-0.02em]">Choose tickets</h2>
                  <span className="text-[13px] text-muted">All fees included</span>
                </div>
                {preview ? (
                  <div className="rounded-xl bg-bg px-4 py-3 text-sm text-muted">Tickets can't be bought until the event is published.</div>
                ) : (
                  <TicketPicker
                    eventId={e.id}
                    source={source}
                    types={s.types}
                    refundUntil={e.refundUntil?.toISOString() ?? null}
                    salesEnd={e.salesEnd?.toISOString() ?? null}
                    startsAt={e.startsAt.toISOString()}
                    canBuy={canBuy && !s.soldOut}
                    blockedReason={canBuy ? undefined : blocked}
                  />
                )}
                {s.soldOut && !preview && <WaitlistForm eventId={e.id} ahead={waitlist} soldCount={s.sold} />}
              </>
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-11 pt-9">
            {s.rescheduled && e.previousStartsAt && !cancelled && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-white px-5 py-4">
                <span className="badge badge-warn">New date</span>
                <span className="text-muted line-through">
                  {dateShort(e.previousStartsAt)} · {timeLabel(e.previousStartsAt)}
                </span>
                <span aria-hidden="true">→</span>
                <strong>
                  {dateShort(e.startsAt)} · {timeLabel(e.startsAt)}
                </strong>
                <span className="text-muted">Existing tickets work for the new date.</span>
              </div>
            )}

            {e.description && (
              <section className="flex max-w-[680px] flex-col gap-3">
                <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.025em]">About this event</h2>
                {e.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="m-0 text-[17px] [text-wrap:pretty]">
                    {p}
                  </p>
                ))}
              </section>
            )}

            {lineup.length > 0 && (
              <section className="flex max-w-[680px] flex-col gap-1">
                <h2 className="m-0 mb-2 font-display text-[28px] font-bold tracking-[-0.025em]">Line-up</h2>
                {lineup.map((l, i) => (
                  <div key={i} className={`flex gap-5 border-t border-line2 py-3.5 ${i === lineup.length - 1 ? "border-b" : ""}`}>
                    <span className="w-[84px] flex-none font-mono text-[15px] font-semibold">{l.time}</span>
                    <div>
                      <div className="font-bold">
                        {l.name}
                        {l.headline && <span className="ml-1.5 rounded-md bg-sun px-2 py-0.5 text-xs font-bold">Headline</span>}
                      </div>
                      {l.note && <div className="text-[15px] text-muted">{l.note}</div>}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {(info.entry || info.refunds || info.accessibility || info.gettingThere) && (
              <section id="info" className="flex max-w-[680px] scroll-mt-6 flex-col gap-1">
                <h2 className="m-0 mb-2 font-display text-[28px] font-bold tracking-[-0.025em]">Before you go</h2>
                {(
                  [
                    ["Entry", info.entry],
                    ["Refunds", info.refunds],
                    ["Accessibility", info.accessibility],
                    ["Getting there", info.gettingThere],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v], i, arr) => (
                    <div key={k} className={`flex flex-wrap gap-x-5 gap-y-1 border-t border-line2 py-3.5 ${i === arr.length - 1 ? "border-b" : ""}`}>
                      <div className="w-[130px] flex-none font-bold">{k}</div>
                      <div className="min-w-[240px] flex-[1_1_300px]">{v}</div>
                    </div>
                  ))}
              </section>
            )}

            <section id="venue" className="flex flex-col gap-3.5">
              <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.025em]">Venue</h2>
              <div className="relative h-[220px] overflow-hidden rounded-2xl border border-line2 bg-[#E7E4F0]" aria-hidden="true">
                <div className="absolute -left-[5%] top-[44%] h-3.5 w-[110%] -rotate-6 bg-white" />
                <div className="absolute -top-[10%] left-[38%] h-[120%] w-3.5 rotate-[14deg] bg-white" />
                <div className="absolute -top-[10%] left-[62%] h-[120%] w-2 -rotate-[20deg] bg-white" />
                <div className="absolute left-[47%] top-[30%] h-7 w-7 -rotate-45 rounded-[50%_50%_50%_0] bg-primary" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold">{e.venueName}</span> <span className="text-muted">· {e.venueAddress || e.city}</span>
                </div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold">
                  Get directions
                </a>
              </div>
            </section>

            <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-6 py-5">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-sun font-display text-xl font-extrabold">{orgInitials}</div>
              <div className="min-w-[220px] flex-[1_1_260px]">
                <div className="text-[13px] text-muted">Hosted by</div>
                <div className="text-lg font-bold">{e.organizer.name}</div>
                <div className="text-sm text-muted">
                  {e.organizer.verified ? "Verified organizer" : "Organizer"} · {hostedCount} {hostedCount === 1 ? "event" : "events"} hosted on Tamasha
                </div>
              </div>
              <Link href={`/?q=${encodeURIComponent(e.organizer.name)}`} className="btn btn-outline h-11 px-[18px]">
                More from them
              </Link>
            </section>

            {similar.length > 0 && (
              <section className="flex flex-col gap-1">
                <h2 className="m-0 mb-2 font-display text-[28px] font-bold tracking-[-0.025em]">More like this</h2>
                {similar.map((x, i) => (
                  <Link key={x.id} href={`/events/${x.slug}?src=discover`} className={`flex items-center gap-4 border-t border-line2 py-4 text-ink no-underline hover:text-ink ${i === similar.length - 1 ? "border-b" : ""}`}>
                    <div className="relative h-[54px] w-[72px] flex-none overflow-hidden rounded-[10px]">
                      <CoverArt preset={x.coverPreset} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{x.title}</div>
                      <div className="truncate text-[15px] text-muted">
                        {dateShort(x.startsAt)} · {timeLabel(x.startsAt)} · {where(x.venueName, x.venueAddress)}
                      </div>
                    </div>
                    <div className="flex-none font-bold">{x.free ? "Free" : `${new Set(x.types.map((t) => t.price)).size > 1 ? "From " : ""}${birr(x.minPrice)}`}</div>
                  </Link>
                ))}
              </section>
            )}

            {!preview && (
              <div>
                <ReportEvent eventId={e.id} />
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
