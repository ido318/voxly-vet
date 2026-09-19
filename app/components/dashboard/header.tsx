"use client";
import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, BellIcon } from "@/components/dashboard/icons";
import { formatSearchResults, type SearchResultRow } from "@/lib/search/format-search-results";
import { useToast } from "@/components/dashboard/ui/toast";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

interface HeaderProps {
  clinicName?: string;
  clinicLocation?: string;
  openEscalations?: number;
}

export function Header({
  clinicName = "Demo Vet Clinic",
  clinicLocation,
  openEscalations = 0,
}: HeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // Bump the token on every run so a slower, earlier-started fetch can
    // recognize it's been superseded and skip updating state when it resolves.
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    if (trimmed.length < 2) {
      startTransition(() => {
        setResults([]);
        setOpen(false);
        setLoading(false);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    const t = setTimeout(() => {
      void (async () => {
        try {
          const [customersRes, petsRes] = await Promise.all([
            fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`),
            fetch(`/api/search?entity=pets&q=${encodeURIComponent(trimmed)}`),
          ]);
          if (!customersRes.ok || !petsRes.ok) {
            throw new Error("search request failed");
          }
          const customersData = (await customersRes.json()) as { data: { customers: Customer[] } };
          const petsData = (await petsRes.json()) as { data: { pets: Pet[] } };
          if (requestIdRef.current !== currentRequestId) return; // a newer search superseded this one
          setResults(formatSearchResults(customersData.data.customers, petsData.data.pets));
          setOpen(true);
        } catch {
          if (requestIdRef.current !== currentRequestId) return;
          setResults([]);
          setOpen(false);
          toast("החיפוש נכשל, נסי שוב", "error");
        } finally {
          if (requestIdRef.current === currentRequestId) setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [query, toast, startTransition]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const goToResult = useCallback((row: SearchResultRow) => {
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/clients?customerId=${row.customerId}`);
  }, [router]);

  return (
    <header
      className="flex items-center gap-4 flex-shrink-0"
      style={{
        height: "var(--header-h)",
        paddingInline: "var(--page-gutter)",
        background: "var(--surface-raised)",
        borderBottom: "var(--rule)",
      }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-[440px]" ref={containerRef}>
        <label
          className="flex items-center gap-2 px-3 text-[var(--text-faint)] focus-within:border-[var(--border-focus)]"
          style={{
            height: "var(--field-h)",
            borderRadius: "var(--radius-2)",
            background: "var(--surface-field)",
            border: "var(--rule)",
            transition: "var(--transition-color)",
          }}
        >
          <SearchIcon size={16} className="flex-shrink-0" />
          <input
            type="search"
            placeholder="חיפוש לקוח, חיה..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            className="flex-1 bg-transparent text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none"
          />
          {loading && (
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{
                border: "1.5px solid var(--text-faint)",
                borderTopColor: "transparent",
                animation: "gvSpin .7s linear infinite",
              }}
            />
          )}
        </label>

        {open && (
          <div className="absolute top-full mt-2 w-full overflow-hidden z-30"
            style={{
              borderRadius: "var(--radius-3)",
              background: "var(--surface-raised)",
              boxShadow: "var(--shadow-modal)",
            }}>
            {results.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-[var(--text-muted)]">אין תוצאות</p>
            ) : (
              <ul>
                {results.map((row) => (
                  <li key={`${row.kind}-${row.id}`}>
                    <button
                      onClick={() => goToResult(row)}
                      className="flex w-full items-center justify-between px-4 text-start hover:bg-[var(--surface-hover)]"
                      style={{ height: "var(--row-h-sub)", transition: "var(--transition-color)" }}
                    >
                      <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{row.title}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{row.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clinic info */}
      <div className="text-end">
        <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{clinicName}</p>
        {clinicLocation && <p className="text-[11px] text-[var(--text-muted)]">{clinicLocation}</p>}
      </div>

      {/* Separator */}
      <div className="h-6 w-px" style={{ background: "var(--border-hairline)" }} />

      {/* Escalations — the red circular badge is retired; the count reads plainly */}
      <Link
        href="/dashboard/escalations"
        className="flex items-center gap-2 px-2"
        style={{
          height: "var(--control-h)",
          borderRadius: "var(--radius-2)",
          color: "var(--text-secondary)",
          transition: "var(--transition-color)",
        }}
        aria-label={`${openEscalations} אסקלציות פתוחות`}
      >
        <BellIcon size={16} />
        {openEscalations > 0 && (
          <span
            className="gv-data text-[12px]"
            style={{ color: "var(--status-critical-text)", fontWeight: "var(--w-semibold)" }}
          >
            {openEscalations}
          </span>
        )}
      </Link>
    </header>
  );
}
