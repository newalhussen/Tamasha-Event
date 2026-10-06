"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

export function useCountdown(expiresAt: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** "Your tickets are held for 9:42" pill shown in the checkout header. */
export function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  const expired = left === 0;
  return (
    <div role="status" className={`flex h-11 items-center gap-2.5 rounded-xl px-4 text-[15px] font-semibold ${expired ? "bg-danger-bg text-danger" : "bg-tint text-primary-dark"}`}>
      <Icon name="clock" size={18} />
      {expired ? (
        "Your hold has expired"
      ) : (
        <>
          Your tickets are held for <span className="mono">{left === null ? "10:00" : mmss(left)}</span>
        </>
      )}
    </div>
  );
}
