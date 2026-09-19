// Re-exports the single source of truth in packages/shared — kept as a thin
// shim so the ~20 existing importers of "@/lib/israel-date" don't need to change.
export * from "@tomer/shared";
