// Re-exports the real implementation, which now lives in lib/ so that
// lib/store.ts calling it is a lib->lib import, not the lib->services
// inversion this used to be (store.ts and routes/jobs.ts both need it —
// jobs.ts's routes->services import was always fine; store.ts's wasn't).
export * from "../lib/notificationProcessor.js";
