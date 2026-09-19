"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/dashboard/icons";
import { useFocusTrap } from "@/components/dashboard/ui/use-focus-trap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // role="dialog" + aria-modal with no name announces as an unnamed dialog:
  // a screen reader says "dialog" and nothing about what it is for.
  const titleId = useId();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useFocusTrap(open && mounted, panelRef);

  if (!open || !mounted) return null;

  // Portalled to document.body — see the matching comment in drawer.tsx.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim-strong)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full modal-enter"
        style={{
          maxWidth: maxWidth ?? "var(--modal-w-lg)",
          background: "var(--surface-raised)",
          borderRadius: "var(--radius-3)",
          boxShadow: "var(--shadow-modal)",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {(title || subtitle) && (
          <div
            className="flex items-start justify-between px-5 py-4"
            style={{ borderBottom: "var(--rule)" }}
          >
            <div>
              {title && (
                <h2
                  id={titleId}
                  className="text-[15px]"
                  style={{ color: "var(--text-primary)", fontWeight: "var(--w-semibold)" }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="grid place-items-center flex-shrink-0 w-[26px] h-[26px]"
              style={{
                borderRadius: "var(--radius-2)",
                color: "var(--text-faint)",
                transition: "var(--transition-color)",
              }}
              aria-label="סגור"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
