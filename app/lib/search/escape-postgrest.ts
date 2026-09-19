/**
 * Escape user search terms before interpolating them into PostgREST
 * `.or("col.ilike.<value>,...")` filters.
 *
 * Two layers:
 * 1. LIKE wildcards (`%`, `_`, `\`) so they are literals, not patterns.
 * 2. Quote the value so PostgREST reserved filter chars (`, . ( )`) cannot
 *    split or rewrite the `.or(...)` expression.
 */
export function escapeIlikeWildcards(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** Quoted `%<escaped query>%` suitable for `column.ilike.<this>` inside `.or()`. */
export function postgrestOrIlikeValue(query: string): string {
  return quotePostgrestFilterValue(`%${escapeIlikeWildcards(query)}%`);
}
