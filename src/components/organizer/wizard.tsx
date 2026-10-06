"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CoverArt } from "@/components/events/cover-art";
import { TicketEditor, type EditorType } from "@/components/organizer/ticket-editor";
import { DateTimeField, type DT } from "@/components/ui/datetime";
import { Field, FormError, Spinner } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { api, ClientError } from "@/lib/client";
import { CATEGORIES, COVER_PRESETS } from "@/lib/enums";
import { ago, birr, dateShort, fromInputParts, n, timeLabel } from "@/lib/format";

export type WizardEvent = {
  id: string;
  slug: string;
  status: string;
  title: string;
  category: string;
  summary: string;
  description: string;
  venueName: string;
  venueAddress: string;
  city: string;
  startsAt: DT;
  endsAt: DT;
  gatesAt: DT;
  ageLimit: number;
  capacity: number;
  coverPreset: string;
  coverText: string;
  lineup: { time: string; name: string; note?: string; headline?: boolean }[];
  info: { entry?: string; refunds?: string; accessibility?: string; gettingThere?: string };
  refundPolicy: string; // "7" | "3" | "1" | "0" | "none" | ""
  startsAtIso: string;
  updatedAt: string;
  reviewReason: string;
};

type Step = "basics" | "where" | "tickets" | "page" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "where", label: "When and where" },
  { key: "tickets", label: "Tickets" },
  { key: "page", label: "Event page" },
  { key: "review", label: "Review and publish" },
];

type Check = { key: string; label: string; done: boolean };

const iso = (d: DT) => (d.date ? (fromInputParts(d.date, d.time || "00:00")?.toISOString() ?? null) : null);

export function Wizard({
  event,
  types,
  checklist,
  verified,
  startStep,
}: {
  event: WizardEvent;
  types: EditorType[];
  checklist: Check[];
  verified: boolean;
  startStep: Step;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStepState] = useState<Step>(startStep);
  const [savedAt, setSavedAt] = useState<string>(event.updatedAt);
  const [published, setPublished] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Local editable copy of the text sections. Saved to the API on Continue.
  const [f, setF] = useState(event);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setStep = (s: Step) => {
    setStepState(s);
    setErrors({});
    setError(null);
    window.history.replaceState(null, "", `?step=${s}`);
    window.scrollTo({ top: 0 });
  };
  const idx = STEPS.findIndex((s) => s.key === step);
  const missing = checklist.filter((c) => !c.done);
  const editable = ["DRAFT", "REJECTED"].includes(event.status);

  async function save(section: "basics" | "where" | "page"): Promise<boolean> {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      let data: unknown;
      if (section === "basics") data = { title: f.title, category: f.category, summary: f.summary };
      else if (section === "where")
        data = {
          startsAt: iso(f.startsAt) ?? "",
          endsAt: iso(f.endsAt),
          gatesAt: f.gatesAt.time && f.startsAt.date ? iso({ date: f.startsAt.date, time: f.gatesAt.time }) : null,
          venueName: f.venueName,
          venueAddress: f.venueAddress,
          city: f.city || "Addis Ababa",
          ageLimit: f.ageLimit,
          capacity: Number(String(f.capacity).replace(/\D/g, "")) || 0,
        };
      else {
        const start = iso(f.startsAt) ?? event.startsAtIso;
        let refundUntil: string | null = null;
        if (f.refundPolicy === "none") refundUntil = new Date(1).toISOString();
        else if (f.refundPolicy !== "") refundUntil = new Date(new Date(start).getTime() - Number(f.refundPolicy) * 86_400_000).toISOString();
        data = {
          description: f.description,
          coverPreset: f.coverPreset,
          coverText: f.coverText,
          lineup: f.lineup.filter((l) => l.name.trim()),
          info: f.info,
          refundUntil,
          salesEnd: null,
        };
      }
      await api(`/api/organizer/events/${event.id}`, { method: "PATCH", body: { section, data } });
      setSavedAt(new Date().toISOString());
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ClientError) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.fields)) mapped[k.replace(/^data\./, "")] = v;
        setErrors(mapped);
        if (!Object.keys(mapped).length) setError(e.message);
        else document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      } else setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (step === "basics" || step === "where" || step === "page") {
      if (!(await save(step))) return;
    }
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await api<{ status: string; slug: string }>(`/api/organizer/events/${event.id}/publish`, { body: {} });
      setPublished(res.status);
      toast(res.status === "PUBLISHED" ? "Published. Your event is live." : "Sent for review.");
      router.refresh();
    } catch (e) {
      setPublishError(e instanceof ClientError ? e.message : "Couldn't publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  const set = <K extends keyof WizardEvent>(k: K, v: WizardEvent[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="min-h-screen bg-bg text-[15px]">
      <header className="bg-night text-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-8">
          <Link href={`/organizer/events/${event.id}`} className="on-dark flex h-11 items-center gap-2 rounded-[10px] pl-2 pr-3 font-semibold text-soft3 no-underline hover:text-white">
            <Icon name="left" size={18} stroke={2.2} />
            Exit
          </Link>
          <div className="flex min-w-[240px] flex-[1_1_280px] flex-wrap items-center gap-2.5">
            <span className="font-display text-[19px] font-bold tracking-[-0.02em]">{f.title || "Untitled event"}</span>
            <span className={`rounded-lg px-[9px] py-[3px] text-xs font-bold ${event.status === "PUBLISHED" ? "bg-primary text-white" : "bg-sun text-ink"}`}>
              {event.status === "DRAFT" ? "Draft" : event.status === "PENDING_REVIEW" ? "In review" : event.status === "PUBLISHED" ? "Live" : event.status === "REJECTED" ? "Not approved" : event.status}
            </span>
            <span className="text-sm text-soft2">Saved {ago(savedAt)}</span>
          </div>
          <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost-dark on-dark">
            Preview
          </a>
          {editable && (
            <>
              <button
                type="button"
                disabled={missing.length > 0 || publishing}
                aria-describedby="pubhint"
                onClick={publish}
                className={`btn on-dark border-0 font-bold ${missing.length > 0 ? "cursor-not-allowed bg-night3 text-soft" : "bg-primary text-white hover:bg-[#3c1fe0]"}`}
              >
                {publishing && <Spinner />}
                {verified ? "Publish" : "Submit for review"}
              </button>
              <span id="pubhint" className="text-sm text-soft2">
                {missing.length > 0 ? `${missing.length} ${missing.length === 1 ? "step" : "steps"} to go` : "Ready to go"}
              </span>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-x-14 gap-y-9 px-4 pb-[72px] pt-9 sm:px-8">
        <nav aria-label="Setup steps" className="flex flex-[0_1_220px] flex-col gap-0.5 max-lg:flex-[1_0_100%] max-lg:flex-row max-lg:flex-wrap">
          {STEPS.map((s, i) => {
            const done = i < idx || (s.key === "tickets" && types.length > 0) || (s.key === "basics" && event.title) || (s.key === "where" && f.venueName && f.capacity > 0 && i < idx);
            const current = s.key === step;
            return (
              <button
                key={s.key}
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => setStep(s.key)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left ${current ? "border border-line bg-white font-bold text-ink" : "border border-transparent bg-transparent font-semibold " + (done ? "text-ink" : "text-muted")}`}
              >
                {current ? (
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">{i + 1}</span>
                ) : done ? (
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-ink">
                    <Icon name="check" size={14} stroke={3.2} className="text-white" />
                  </span>
                ) : (
                  <span className="box-border flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-field text-[13px] font-bold">{i + 1}</span>
                )}
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {event.reviewReason && event.status !== "PUBLISHED" && (
            <div role="alert" className="rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">
              <strong>Note from Tamasha:</strong> {event.reviewReason}
            </div>
          )}

          {step === "basics" && (
            <>
              <Heading title="Basics" sub="Name your event and pick the category people will find it under." />
              <Field label="Event name" error={errors.title}>
                {(p) => <input {...p} className="input" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={100} autoFocus />}
              </Field>
              <Field label="Category" error={errors.category}>
                {(p) => (
                  <select {...p} className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="One-line summary" error={errors.summary} hint="Shown on discovery cards and search. Up to 200 characters.">
                {(p) => <input {...p} className="input" value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={200} />}
              </Field>
            </>
          )}

          {step === "where" && (
            <>
              <Heading title="When and where" sub="Times are in Addis Ababa time (EAT)." />
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
                <DateTimeField label="Starts" value={f.startsAt} onChange={(v) => set("startsAt", v)} error={errors.startsAt} />
                <DateTimeField label="Ends" optional value={f.endsAt} onChange={(v) => set("endsAt", v)} error={errors.endsAt} />
              </div>
              <Field label="Gates open (optional)" error={errors.gatesAt}>
                {(p) => <input {...p} type="time" className="input max-w-[180px]" value={f.gatesAt.time} onChange={(e) => set("gatesAt", { date: f.startsAt.date, time: e.target.value })} />}
              </Field>
              <Field label="Venue name" error={errors.venueName}>
                {(p) => <input {...p} className="input" value={f.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="e.g. Skyline Rooftop" />}
              </Field>
              <Field label="Address" error={errors.venueAddress} hint="Neighbourhood second to last helps buyers: “4th floor, Skyline Building, Bole Road, Addis Ababa”.">
                {(p) => <input {...p} className="input" value={f.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} />}
              </Field>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))" }}>
                <Field label="City" error={errors.city}>
                  {(p) => <input {...p} className="input" value={f.city} onChange={(e) => set("city", e.target.value)} />}
                </Field>
                <Field label="Age limit" error={errors.ageLimit}>
                  {(p) => (
                    <select {...p} className="input" value={f.ageLimit} onChange={(e) => set("ageLimit", Number(e.target.value))}>
                      <option value={0}>All ages</option>
                      <option value={16}>16+</option>
                      <option value={18}>18+</option>
                      <option value={21}>21+</option>
                    </select>
                  )}
                </Field>
                <Field label="Venue capacity" error={errors.capacity} hint="The most people the venue can hold.">
                  {(p) => <input {...p} inputMode="numeric" className="input font-semibold" value={f.capacity || ""} onChange={(e) => set("capacity", Number(e.target.value.replace(/\D/g, "")) || 0)} />}
                </Field>
              </div>
            </>
          )}

          {step === "tickets" && (
            <>
              <Heading title="Tickets" sub="One ticket type is enough to publish. You can add or change them later, even while on sale." />
              <TicketEditor eventId={event.id} capacity={f.capacity} types={types} />
            </>
          )}

          {step === "page" && (
            <>
              <Heading title="Event page" sub="This is what buyers read before they decide." />
              <Field label="Description" error={errors.description} hint="Leave a blank line between paragraphs.">
                {(p) => <textarea {...p} rows={7} className="input" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />}
              </Field>

              <div className="flex flex-col gap-3">
                <div className="label">Artwork</div>
                <div role="radiogroup" aria-label="Artwork style" className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
                  {COVER_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={f.coverPreset === p}
                      aria-label={`Artwork style ${p}`}
                      onClick={() => set("coverPreset", p)}
                      className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-line p-0 ${f.coverPreset === p ? "outline outline-[3px] outline-offset-2 outline-primary" : "border border-line2"}`}
                    >
                      <CoverArt preset={p} />
                    </button>
                  ))}
                </div>
                <Field label="Big title on the artwork (optional)" error={errors.coverText} hint="Use a line break for two lines, like “ABAY” then “VOL. 9”.">
                  {(p) => <textarea {...p} rows={2} className="input" value={f.coverText} maxLength={40} onChange={(e) => set("coverText", e.target.value)} />}
                </Field>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <div className="label">Line-up (optional)</div>
                  <button type="button" className="btn-link btn !min-h-0" onClick={() => set("lineup", [...f.lineup, { time: "", name: "", note: "" }])}>
                    Add act
                  </button>
                </div>
                {f.lineup.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
                    <input aria-label="Start time" className="input !h-11 !w-[110px]" placeholder="7:00 PM" value={l.time} onChange={(e) => set("lineup", f.lineup.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                    <input aria-label="Act name" className="input !h-11 min-w-[160px] flex-1" placeholder="Name" value={l.name} onChange={(e) => set("lineup", f.lineup.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input aria-label="Note" className="input !h-11 min-w-[160px] flex-1" placeholder="Note (optional)" value={l.note ?? ""} onChange={(e) => set("lineup", f.lineup.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" className="h-5 w-5 accent-primary" checked={!!l.headline} onChange={(e) => set("lineup", f.lineup.map((x, j) => (j === i ? { ...x, headline: e.target.checked } : x)))} />
                      Headline
                    </label>
                    <button type="button" aria-label="Remove act" className="btn !px-3" onClick={() => set("lineup", f.lineup.filter((_, j) => j !== i))}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
                {(
                  [
                    ["entry", "Entry"],
                    ["accessibility", "Accessibility"],
                    ["gettingThere", "Getting there"],
                    ["refunds", "Refunds (wording)"],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label} error={errors[`info.${k}`]}>
                    {(p) => <textarea {...p} rows={2} className="input" maxLength={400} value={f.info[k] ?? ""} onChange={(e) => set("info", { ...f.info, [k]: e.target.value })} />}
                  </Field>
                ))}
              </div>

              <Field label="Refund policy" error={errors.refundUntil} hint="Applies to paid tickets. Buyers can always cancel free registrations.">
                {(p) => (
                  <select {...p} className="input max-w-[420px]" value={f.refundPolicy} onChange={(e) => set("refundPolicy", e.target.value)}>
                    <option value="">Choose a policy…</option>
                    <option value="7">Full refund until 7 days before</option>
                    <option value="3">Full refund until 3 days before</option>
                    <option value="1">Full refund until 1 day before</option>
                    <option value="0">Full refund until the event starts</option>
                    <option value="none">No refunds (you can still approve requests)</option>
                  </select>
                )}
              </Field>
            </>
          )}

          {step === "review" && (
            <>
              <Heading title="Review and publish" sub={verified ? "Check everything, then go live." : "Your account is new, so a person at Tamasha takes a quick look before this goes live."} />
              {published ? (
                <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-white p-6">
                  <div className="font-display text-2xl font-bold">{published === "PUBLISHED" ? "Your event is live" : "Sent for review"}</div>
                  <p className="m-0 text-muted">{published === "PUBLISHED" ? "Share the link and watch sales come in." : "We'll publish it as soon as it's approved, usually within a few hours."}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/organizer/events/${event.id}`} className="btn btn-dark btn-md">
                      Go to event dashboard
                    </Link>
                    {published === "PUBLISHED" && (
                      <Link href={`/events/${event.slug}`} className="btn btn-md">
                        View event page
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="card divide-y divide-line">
                    {[
                      ["Event", `${f.title} · ${f.category}`],
                      ["When", f.startsAt.date ? `${dateShort(iso(f.startsAt)!)} · ${timeLabel(iso(f.startsAt)!)}` : "Not set"],
                      ["Where", f.venueName ? `${f.venueName}${f.venueAddress ? `, ${f.venueAddress}` : ""}` : "Not set"],
                      ["Capacity", f.capacity ? n(f.capacity) : "Not set"],
                      ["Tickets", types.length ? types.map((t) => `${t.name} (${t.kind === "FREE" ? "Free" : birr(t.price)} × ${n(t.quantity)})`).join(" · ") : "None yet"],
                      ["Refunds", f.refundPolicy === "none" ? "No refunds" : f.refundPolicy ? `Full refund until ${f.refundPolicy === "0" ? "the event starts" : f.refundPolicy + " day(s) before"}` : "Not chosen"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-3.5">
                        <div className="w-[110px] flex-none text-muted">{k}</div>
                        <div className="min-w-0 flex-1 font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                  <FormError message={publishError} />
                  {editable ? (
                    <button type="button" className="btn btn-primary btn-lg self-start" disabled={missing.length > 0 || publishing} onClick={publish}>
                      {publishing && <Spinner />}
                      {verified ? "Publish event" : "Submit for review"}
                    </button>
                  ) : (
                    <p className="text-muted">This event is already {event.status === "PUBLISHED" ? "live" : "in review"}. Changes you save appear on the event page straight away.</p>
                  )}
                  {missing.length > 0 && <p className="m-0 text-muted">Finish the open items in the checklist to publish.</p>}
                </>
              )}
            </>
          )}

          <FormError message={error} />
          <div className="flex flex-wrap justify-between gap-3 border-t border-line2 pt-5">
            <button type="button" className="btn btn-outline h-[52px] rounded-[14px] px-5" disabled={idx === 0 || busy} onClick={() => setStep(STEPS[idx - 1].key)}>
              Back
            </button>
            {idx < STEPS.length - 1 && (
              <button type="button" className="btn btn-primary h-[52px] rounded-[14px] px-[26px] text-base" disabled={busy} onClick={next}>
                {busy && <Spinner />}
                Continue to {STEPS[idx + 1].label.toLowerCase()}
              </button>
            )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="eyebrow">What buyers will see</div>
            <div className="flex flex-col rounded-2xl border border-line bg-white px-5 py-[18px]">
              <div className="pb-2.5 font-display text-lg font-bold">Choose tickets</div>
              {types.length === 0 && <div className="border-t border-line py-3 text-sm text-muted">Ticket types you add appear here.</div>}
              {types.map((t) => (
                <div key={t.id} className="flex justify-between gap-3 border-t border-line py-3">
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-sm text-muted">{n(Math.max(0, t.quantity - t.sold))} left</div>
                  </div>
                  <div className="font-semibold">{t.kind === "FREE" ? "Free" : birr(t.price)}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="flex flex-col">
            <h2 className="m-0 border-b-2 border-ink pb-2.5 font-display text-xl font-bold tracking-[-0.02em]">Before you can publish</h2>
            {checklist.map((c) => (
              <div key={c.key} className={`flex min-h-12 items-center gap-3 border-b border-line2 ${c.done ? "" : "font-semibold"}`}>
                {c.done ? <Icon name="check" size={18} stroke={3} className="text-primary" /> : <span className="box-border h-[18px] w-[18px] flex-none rounded-full border-2 border-field" />}
                {c.label}
              </div>
            ))}
            {checklist.some((c) => c.key === "payout" && !c.done) && (
              <Link href="/organizer/settings" className="pt-2 text-sm font-semibold">
                Add or verify your payout account
              </Link>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="h-display text-[clamp(30px,4vw,40px)] leading-[1.05]">{title}</h1>
      <p className="m-0 text-[17px] text-muted">{sub}</p>
    </div>
  );
}
