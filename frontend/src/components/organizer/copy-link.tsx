"use client";

import { useToast } from "@/components/ui/toast";

export function CopyLink({ path, label = "Copy event link", className = "btn btn-ghost-dark btn-md on-dark" }: { path: string; label?: string; className?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.origin + path);
          toast("Link copied");
        } catch {
          toast("Couldn't copy. Select the link and copy it manually.", "error");
        }
      }}
    >
      {label}
    </button>
  );
}
