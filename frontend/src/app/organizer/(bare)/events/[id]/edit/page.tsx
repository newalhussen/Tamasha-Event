import type { Metadata } from "next";
import { Wizard, type WizardEvent } from "@/components/organizer/wizard";
import { requirePage } from "@/lib/auth";
import { toInputParts } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import type { EventDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit event" };
export const dynamic = "force-dynamic";

const STEPS = ["basics", "where", "tickets", "page", "review"] as const;

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const { step } = await searchParams;
  const user = await requirePage(["ORGANIZER"], `/organizer/events/${id}/edit`);
  const { event: e, summary: s, checklist } = await apiGet<EventDetail>(`/organizer/events/${id}`);

  // Map the stored refund deadline back to the policy choices shown in the wizard.
  let refundPolicy = "";
  if (e.refundUntil) {
    if (new Date(e.refundUntil).getTime() < new Date(e.createdAt).getTime()) refundPolicy = "none";
    else {
      const days = Math.round((new Date(e.startsAt).getTime() - new Date(e.refundUntil).getTime()) / 86_400_000);
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
    lineup: e.lineup ?? [],
    info: e.info ?? {},
    refundPolicy,
    startsAtIso: e.startsAt,
    updatedAt: e.updatedAt,
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
