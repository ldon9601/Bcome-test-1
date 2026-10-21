"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/** Native <dialog> wrapper: focus trapping, Escape and backdrop clicks come from the browser. */
export function Modal({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="detail"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div style={{ position: "relative" }}>
          <button className="detail-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
          {children}
        </div>
      )}
    </dialog>
  );
}
