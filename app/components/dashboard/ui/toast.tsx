"use client";
import React, { createContext, useContext, useCallback, useState } from "react";
import { XIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoCircleIcon } from "@/components/dashboard/icons";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/**
 * A single colour mark carries the variant — the system uses no icon badge here.
 * The toast sits on dark graphite, so these take the light end of each hue: the
 * status *text* tones are built for light washes and would sink into this
 * surface. Same reasoning as the rail's lightened critical count.
 */
const VARIANT_MARK: Record<ToastVariant, string> = {
  success: "var(--green-100)",
  error:   "var(--red-100)",
  warning: "var(--amber-100)",
  info:    "var(--steel-100)",
};

// Severity is never colour-alone — each variant also gets a distinct shape.
const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircleIcon,
  error:   XCircleIcon,
  warning: AlertTriangleIcon,
  info:    InfoCircleIcon,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — bottom-start (left in RTL) */}
      <div
        className="fixed bottom-6 start-6 z-50 flex flex-col gap-2 pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={(id) => setToasts((p) => p.filter((x) => x.id !== id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? "success";
  const VariantIcon = VARIANT_ICON[variant];

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-sm px-4 py-3 toast-enter"
      style={{
        background: "var(--graphite-800)",
        color: "#fff",
        borderRadius: "var(--radius-2)",
        boxShadow: "var(--shadow-modal)",
      }}
    >
      <span className="flex-shrink-0" style={{ color: VARIANT_MARK[variant] }}>
        <VariantIcon size={18} />
      </span>
      <p className="flex-1 text-[13px]" style={{ fontWeight: "var(--w-medium)" }}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100"
        style={{ transition: "opacity var(--dur-fast) var(--ease)" }}
        aria-label="סגור"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
