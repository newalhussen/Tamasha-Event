import type { Organizer, User } from "@prisma/client";
import { db } from "../db/prisma";
import { ApiError, notFound } from "../utils/errors";
import { dateShort } from "../utils/format";
import { formatPhone } from "../utils/phone";
import { adminCounts, reviewDetail, reviewQueue } from "./admin.service";
import { eventPhase } from "./events.service";

const DAY = 86_400_000;

/* --------------------------------------------------------------- organizers */

export type OrgInfo = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  joined: string;
  events: number;
  status: string;
  verified: boolean;
  payoutBank: string | null;
  payoutAccountMasked: string | null;
  payoutVerified: boolean;
  payoutSubmitted: boolean;
  note: string;
};

function orgInfo(o: Organizer & { user: User; _count: { events: number } }): OrgInfo {
  return {
    id: o.id,
    name: o.name,
    ownerName: o.user.name,
    ownerEmail: o.user.email,
    ownerPhone: formatPhone(o.user.phone),
    joined: dateShort(o.createdAt),
    events: o._count.events,
    status: o.status,
    verified: o.verified,
    payoutBank: o.payoutBank,
    payoutAccountMasked: o.payoutAccount ? `••••${o.payoutAccount.slice(-4)}` : null,
    payoutVerified: o.payoutVerified,
    payoutSubmitted: !!o.payoutAccount,
    note: o.verificationNote,
  };
}

export async function organizerAction(adminId: string, orgId: string, action: string, note?: string) {
  const org = await db.organizer.findUnique({ where: { id: orgId } });
  if (!org) throw notFound("That organizer");
  switch (action) {
    case "VERIFY":
      await db.organizer.update({ where: { id: orgId }, data: { verified: true, status: "VERIFIED", verificationNote: "" } });
      break;
    case "VERIFY_PAYOUT":
      if (!org.payoutAccount) throw new ApiError(422, "This organizer has not added a payout account yet.", "NO_PAYOUT");
      await db.organizer.update({ where: { id: orgId }, data: { payoutVerified: true } });
      break;
    case "SUSPEND":
      await db.organizer.update({ where: { id: orgId }, data: { status: "SUSPENDED", verified: false, verificationNote: note ?? "" } });
      break;
    case "REINSTATE":
      await db.organizer.update({ where: { id: orgId }, data: { status: org.verified ? "VERIFIED" : "PENDING", verificationNote: "" } });
      break;
    case "REQUEST_DETAILS":
      if (!note || note.length < 5) throw new ApiError(422, "Say what details you need.", "NOTE_REQUIRED", { note: "Say what is missing." });
      await db.organizer.update({ where: { id: orgId }, data: { verificationNote: note } });
      break;
  }
  await db.moderationLog.create({ data: { adminId, organizerId: orgId, action: `ORG_${action}`, note: note ?? "" } });
}

export async function setUserStatus(adminId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
  if (userId === adminId) throw new ApiError(409, "You cannot suspend your own account.", "SELF");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("That user");
  if (user.role === "ADMIN") throw new ApiError(403, "Admin accounts cannot be suspended here.", "ADMIN_PROTECTED");
  await db.user.update({ where: { id: userId }, data: { status } });
  await db.moderationLog.create({ data: { adminId, action: `USER_${status}`, note: user.email } });
}

export async function setReportStatus(adminId: string, reportId: string, status: "RESOLVED" | "DISMISSED") {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("That report");
  await db.report.update({ where: { id: reportId }, data: { status, resolvedAt: new Date() } });
  await db.moderationLog.create({ data: { adminId, eventId: report.eventId, action: `REPORT_${status}`, note: report.reason } });
}

/* ------------------------------------------------------------------ overview */

export async function overview(selectedId: string | undefined, now = new Date()) {
  const dayAgo = new Date(now.getTime() - DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [queue, live, soldToday, revenueToday, newOrgs, pendingOrgs, openReports, orgs, log] = await Promise.all([
    reviewQueue(now),
    db.event.count({ where: { status: "PUBLISHED", OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] } }),
    db.ticket.count({ where: { status: { in: ["VALID", "CHECKED_IN"] }, order: { paidAt: { gte: dayAgo } } } }),
    db.ticket.aggregate({ where: { status: { in: ["VALID", "CHECKED_IN"] }, order: { paidAt: { gte: dayAgo } } }, _sum: { price: true } }),
    db.organizer.count({ where: { createdAt: { gte: weekAgo } } }),
    db.organizer.count({ where: { status: "PENDING" } }),
    db.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.organizer.findMany({ where: { status: "PENDING" }, include: { user: true, _count: { select: { events: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.moderationLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { admin: true, event: { select: { title: true } } } }),
  ]);

  const current = queue.find((q) => q.id === selectedId) ?? queue[0];
  const d = current ? await reviewDetail(current.id, now) : null;
  const detail =
    d && current
      ? {
          id: d.event.id,
          slug: d.event.slug,
          title: d.event.title,
          startsAt: d.event.startsAt,
          venueName: d.event.venueName,
          status: d.event.status,
          free: d.summary.free,
          minPrice: d.summary.minPrice,
          sold: d.sold,
          reportReasons: [...new Set(d.event.reports.map((r) => r.reason))],
          firstReportDetails: d.event.reports[0]?.details ?? "",
          organizer: {
            name: d.event.organizer.name,
            createdAt: d.event.organizer.createdAt,
            otherEvents: d.event.organizer._count.events - 1,
            payoutVerified: d.event.organizer.payoutVerified,
            payoutSubmitted: !!d.event.organizer.payoutAccount,
          },
          dupe: d.dupe
            ? {
                organizerName: d.dupe.organizer.name,
                organizerVerified: d.dupe.organizer.verified,
                priceDiff: Math.min(...d.dupe.ticketTypes.map((t) => t.price)) - d.summary.minPrice,
              }
            : null,
        }
      : null;

  return {
    stats: {
      live,
      queueCount: queue.length,
      soldToday,
      revenueToday: revenueToday._sum.price ?? 0,
      newOrgs,
      pendingOrgs,
      openReports: openReports.length,
      staleReports: openReports.filter((r) => now.getTime() - r.createdAt.getTime() > DAY).length,
    },
    queue,
    currentId: current?.id ?? null,
    currentReason: current ? { reason: current.reason, tone: current.tone } : null,
    detail,
    orgs: orgs.map(orgInfo),
    log,
  };
}

export { adminCounts };

/* --------------------------------------------------------------------- lists */

export async function eventsList(q: string, status: string, page: number, pageSize = 20) {
  const where = {
    ...(status !== "all" ? { status } : {}),
    ...(q.trim()
      ? {
          OR: [
            { title: { contains: q.trim(), mode: "insensitive" as const } },
            { organizer: { name: { contains: q.trim(), mode: "insensitive" as const } } },
            { venueName: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.event.findMany({
      where,
      include: {
        organizer: true,
        _count: { select: { tickets: { where: { status: { in: ["VALID", "CHECKED_IN"] } } }, reports: { where: { status: "OPEN" } } } },
      },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.event.count({ where }),
  ]);
  return {
    total,
    page,
    pageSize,
    rows: rows.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      startsAt: e.startsAt,
      venueName: e.venueName,
      status: e.status,
      phase: eventPhase(e),
      flag: e.flag,
      organizer: { name: e.organizer.name, verified: e.organizer.verified, status: e.organizer.status },
      tickets: e._count.tickets,
      openReports: e._count.reports,
    })),
  };
}

export async function organizersList(status: string) {
  const rows = await db.organizer.findMany({
    where: status === "all" ? {} : { status },
    include: { user: true, _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({ ...orgInfo(o), createdAt: o.createdAt }));
}

export async function usersList(q: string, role: string, page: number, pageSize = 25) {
  const digits = q.replace(/\D/g, "");
  const where = {
    ...(role !== "all" ? { role } : {}),
    ...(q.trim()
      ? {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" as const } },
            { email: { contains: q.trim(), mode: "insensitive" as const } },
            ...(digits ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      include: { _count: { select: { orders: { where: { status: "PAID" } } } }, organizer: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);
  return {
    total,
    page,
    pageSize,
    rows: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      orders: u._count.orders,
      organizerName: u.organizer?.name ?? null,
    })),
  };
}

export async function reportsList(status: string) {
  const reports = await db.report.findMany({
    where: status === "all" ? {} : { status },
    include: { event: { include: { organizer: true } }, reporter: true },
    orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
    take: 100,
  });
  return reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt,
    eventId: r.eventId,
    eventSlug: r.event.slug,
    eventTitle: r.event.title,
    organizerName: r.event.organizer.name,
    reporterName: r.reporter?.name ?? null,
  }));
}
