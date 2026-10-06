import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getManagedEvent } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { attendeesCsv } from "@/lib/attendees";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  const event = await getManagedEvent(user, id);
  const csv = await attendeesCsv(id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-attendees.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
