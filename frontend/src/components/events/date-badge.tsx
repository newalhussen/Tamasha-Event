import { dayNum, dow } from "@/lib/format";

/** Calendar tile: weekday on a dark band over the day number. */
export function DateBadge({ date, size = "md", muted = false, className = "" }: { date: string | Date; size?: "sm" | "md" | "lg"; muted?: boolean; className?: string }) {
  const dims = {
    sm: { w: 52, band: "text-[10px]", num: "text-[22px]", r: "rounded-[10px]" },
    md: { w: 52, band: "text-[10px]", num: "text-[22px]", r: "rounded-[10px]" },
    lg: { w: 60, band: "text-[11px]", num: "text-[26px]", r: "rounded-[12px]" },
  }[size];
  const tone = muted ? "border-muted text-muted" : "border-ink";
  return (
    <div className={`flex-none overflow-hidden border-[1.5px] text-center ${tone} ${dims.r} ${className}`} style={{ width: dims.w }} aria-hidden="true">
      <div className={`py-[3px] font-mono font-semibold uppercase tracking-[0.06em] text-white ${dims.band} ${muted ? "bg-muted" : "bg-ink"}`}>{dow(date)}</div>
      <div className={`font-display font-bold leading-tight ${dims.num}`}>{dayNum(date)}</div>
    </div>
  );
}
