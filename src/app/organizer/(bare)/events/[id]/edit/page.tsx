import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wizard, type WizardEvent } from "@/components/organizer/wizard";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { includeRels, safeJson, summarize, ticketCounts } from "@/lib/events";
import { toInputParts } from "@/lib/format";
import { publishChecklist } from "@/lib/publishing";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

const STEPS = ["basics", "where", "tickets", "page", "review"] as const;

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/edit`);
  const e = await db.event.findFirst({ where: { id, organizerId: user.organizer!.id }, include: { ...includeRels } });
  if (!e) notFound();

  const counts = await ticketCounts([id]);
  const s = summarize(e, counts);
  const checklist = publishChecklist(e).map(({ key, label, done }) => ({ key, label, done }));

  let refundPolicy = "";
  if (e.refundUntil) {
    if (e.refundUntil.getTime() < e.createdAt.getTime()) refundPolicy = "none";
    else {
      const days = Math.round((e.startsAt.getTime() - e.refundUntil.getTime()) / 86_400_000);
      refundPolicy = ["0", "1", "3", "7"].includes(String(days)) ? String(days) : days > 7 ? "7" : String(Math.max(0, days));
    }
  }

  const event: WizardEvent = {
    id: e.id,
    slug: e.slug,
    status: e.status,
    title: e.title,
    category: e.category,
    summary: e.summary,
    description: e.description,
    venueName: e.venueName,
    venueAddress: e.venueAddress,
    city: e.city,
    startsAt: toInputParts(e.startsAt),
    endsAt: toInputParts(e.endsAt),
    gatesAt: { date: toInputParts(e.startsAt).date, time: toInputParts(e.gatesAt).time },
    ageLimit: e.ageLimit,
    capacity: e.capacity,
    coverPreset: e.coverPreset,
    coverText: e.coverText,
    lineup: safeJson(e.lineup, []),
    info: safeJson(e.info, {}),
    refundPolicy,
    startsAtIso: e.startsAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    reviewReason: e.reviewReason,
  };

  const startStep = (STEPS as readonly string[]).includes(step ?? "") ? (step as (typeof STEPS)[number]) : "basics";
  return (
    <Wizard
      event={event}
      checklist={checklist}
      verified={user.organizer!.verified}
      startStep={startStep}
      types={s.types.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        price: t.price,
        quantity: t.quantity,
        sold: t.sold,
        held: t.held,
        description: t.description,
        perOrderMax: t.perOrderMax,
        saleStart: t.saleStart,
        saleEnd: t.saleEnd,
      }))}
    />
  );
}
