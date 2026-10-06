import { CURRENCY, TIME_ZONE } from "./enums";

const num = new Intl.NumberFormat("en-US");

/** ETB 1,800 */
export function birr(amount: number): string {
  return `${CURRENCY} ${num.format(Math.round(amount))}`;
}

export function priceLabel(price: number, kind: string = "PAID"): string {
  if (kind === "FREE" || price === 0) return "Free";
  return birr(price);
}

export function n(value: number): string {
  return num.format(value);
}

function fmt(d: Date | string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts }).format(new Date(d));
}

/** Sat */
export const dow = (d: Date | string) => fmt(d, { weekday: "short" });
/** 17 */
export const dayNum = (d: Date | string) => fmt(d, { day: "numeric" });
/** Oct */
export const monthShort = (d: Date | string) => fmt(d, { month: "short" });
/** Sat 17 Oct */
export const dateShort = (d: Date | string) => `${dow(d)} ${dayNum(d)} ${monthShort(d)}`;
/** Saturday 17 October */
export const dateLong = (d: Date | string) => fmt(d, { weekday: "long", day: "numeric", month: "long" });
/** Sat 17 Oct 2026 */
export const dateFull = (d: Date | string) => `${dateShort(d)} ${fmt(d, { year: "numeric" })}`;
/** 7:00 PM */
export function timeLabel(d: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));
}
/** 17 Oct, 7:00 PM */
export const dateTime = (d: Date | string) => `${dayNum(d)} ${monthShort(d)}, ${timeLabel(d)}`;

/** yyyy-MM-dd and HH:mm in Addis time, for <input type="date|time"> values. */
export function toInputParts(d: Date | string | null | undefined): { date: string; time: string } {
  if (!d) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Parse Addis-local date + time inputs (UTC+3, no DST) to a Date. */
export function fromInputParts(date: string, time: string): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "00:00"}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(d: Date | string, now = new Date()): number {
  return Math.ceil((new Date(d).getTime() - now.getTime()) / 86_400_000);
}

export function relativeDays(d: Date | string, now = new Date()): string {
  const days = daysUntil(d, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function ago(d: Date | string, now = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(d).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function waiting(d: Date | string, now = new Date()): string {
  const mins = Math.max(1, Math.round((now.getTime() - new Date(d).getTime()) / 60000));
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} ${hrs === 1 ? "hour" : "hours"}`;
  return `${Math.round(hrs / 24)} days`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "event"
  );
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "4th floor, Skyline Building, Bole Road, Addis Ababa" -> "Bole Road" (the neighbourhood part). */
export function area(address: string | null | undefined): string {
  const parts = (address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

/** "Skyline Rooftop, Bole Road" */
export function where(venueName: string, address?: string | null): string {
  const a = area(address);
  return a ? `${venueName}, ${a}` : venueName;
}
