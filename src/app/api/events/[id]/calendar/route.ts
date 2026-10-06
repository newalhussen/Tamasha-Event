import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** iCalendar download ("Add to calendar"). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await db.event.findFirst({ where: { id, status: { in: ["PUBLISHED", "CANCELLED"] } } });
  if (!e) return NextResponse.json({ error: "That event could not be found." }, { status: 404 });
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3_600_000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tamasha//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@tamasha`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc([e.venueName, e.venueAddress].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(e.summary || e.title)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${e.slug}.ics"` },
  });
}
