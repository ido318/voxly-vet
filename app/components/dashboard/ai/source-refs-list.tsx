export function SourceRefsList({ refs }: { refs: Array<{ label: string; href?: string }> }) {
  if (refs.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-[var(--muted)]">
      {refs.map((ref) => (
        <li key={`${ref.label}-${ref.href ?? ""}`}>
          {ref.href ? (
            <a href={ref.href} className="font-semibold text-[var(--brand-600)] hover:underline">
              {ref.label}
            </a>
          ) : ref.label}
        </li>
      ))}
    </ul>
  );
}
