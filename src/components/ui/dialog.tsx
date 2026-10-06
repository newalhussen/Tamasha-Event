"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

/** Accessible modal built on the native <dialog> (focus trap, Esc to close, inert background). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-32px)] rounded-[20px] border border-line bg-white p-0 text-ink shadow-[0_24px_64px_rgba(21,18,31,0.3)] backdrop:bg-night/60"
      style={{ maxWidth: width }}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="dialog-title" className="h2">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-neutral">
              <Icon name="x" size={18} stroke={2.4} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
