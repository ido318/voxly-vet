import React from "react";

interface SkeletonProps {
  className?: string;
  height?: number | string;
  width?: number | string;
}

export function Skeleton({ className = "", height, width }: SkeletonProps) {
  return (
    <span
      className={["skeleton block", className].join(" ")}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={["p-4 space-y-3", className].join(" ")}
      style={{
        background: "var(--surface-raised)",
        borderRadius: "var(--radius-3)",
        boxShadow: "var(--shadow-raised)",
      }}
    >
      <Skeleton height={14} width="60%" />
      <Skeleton height={12} width="80%" />
      <Skeleton height={12} width="40%" />
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={["flex items-center gap-3 px-4", className].join(" ")}
      style={{ height: "var(--row-h)" }}
    >
      <Skeleton height={32} width={32} className="rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton height={13} width="50%" />
        <Skeleton height={11} width="70%" />
      </div>
      <Skeleton height={20} width={56} />
    </div>
  );
}
