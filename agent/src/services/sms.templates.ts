// Re-exports the single source of truth in packages/shared — kept as a thin
// shim so existing importers of "../services/sms.templates.js" don't need to change.
export * from "@tomer/shared";
