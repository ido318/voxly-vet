/**
 * Clears operational clinic data so the pilot can start from a clean slate.
 *
 * Deliberately KEEPS voice_calls and everything hanging off them — the
 * transcripts, recordings and call_reviews are the corpus the prompt-learning
 * loop analyses, so wiping them would defeat the point of running the agent.
 * voice_calls' links to customers/pets/appointments/visits are ON DELETE SET
 * NULL, so the calls survive this with their content intact and their links
 * emptied.
 *
 * Also keeps audit_logs and ai_events: those are system records, not demo data.
 *
 * Every foreign key below is RESTRICT, so DELETE_ORDER is load-bearing — a
 * wrong order fails loudly rather than cascading silently, which is why it is
 * spelled out rather than looped over the table list.
 *
 * SCOPED TO ONE CLINIC. It was not: every delete used
 * `.not("id", "is", null)`, which is a filter that matches every row, with the
 * service-role key — so RLS was bypassed and the script wiped every tenant in
 * the database despite being called reset-CLINIC-data. The dry run did not
 * protect against this; it counted globally too. --clinic-id is now required.
 *
 * Also requires a project-ref confirmation that matches SUPABASE_URL, and
 * refuses tables that cannot be clinic-scoped (no clinic_id column).
 *
 * Usage:
 *   node scripts/reset-clinic-data.mjs --clinic-id=<uuid> --project-ref=<ref>
 *   node scripts/reset-clinic-data.mjs --clinic-id=<uuid> --project-ref=<ref> --confirm
 *
 * Env (required, no defaults — this points at production if you point it there):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CLINIC_ID              # optional fallback if --clinic-id= is omitted
 *   SUPABASE_PROJECT_REF   # optional fallback if --project-ref= is omitted
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmed = process.argv.includes("--confirm");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clinicId =
  process.argv.find((arg) => arg.startsWith("--clinic-id="))?.slice("--clinic-id=".length) ||
  process.env.CLINIC_ID;
const projectRefConfirm =
  process.argv.find((arg) => arg.startsWith("--project-ref="))?.slice("--project-ref=".length) ||
  process.env.SUPABASE_PROJECT_REF;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Required, and required to be a UUID: without it every query below would run
// unscoped against every clinic in the database.
if (!clinicId || !UUID_RE.test(clinicId)) {
  console.error("Missing or malformed --clinic-id=<uuid>.");
  console.error("This script deletes data. It will not run without knowing whose.");
  process.exit(1);
}

function extractProjectRef(supabaseUrl) {
  const host = new URL(supabaseUrl).hostname;
  const hosted = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
  return hosted ? hosted[1] : host;
}

function isMissingClinicIdColumn(message) {
  return (
    Boolean(message) &&
    /clinic_id/i.test(message) &&
    /(does not exist|schema cache|could not find)/i.test(message)
  );
}

let expectedRef;
try {
  expectedRef = extractProjectRef(url);
} catch {
  console.error(`Invalid SUPABASE_URL: ${url}`);
  process.exit(1);
}

if (!projectRefConfirm) {
  console.error("Missing --project-ref=<ref> (or SUPABASE_PROJECT_REF).");
  console.error(`This URL's project ref is "${expectedRef}". Pass that value to confirm the target.`);
  process.exit(1);
}

if (projectRefConfirm !== expectedRef) {
  console.error(
    `Project ref mismatch: confirmed "${projectRefConfirm}" but SUPABASE_URL host is "${expectedRef}".`,
  );
  process.exit(1);
}

/** Children before parents. Do not reorder without re-checking the FK rules. */
const DELETE_ORDER = [
  "visit_shares",
  "medical_notes",
  "prescriptions",
  "vaccinations",
  "lab_orders",
  "visit_charges",
  "vitals",
  "follow_ups",
  "invoices",
  "tasks",
  "waitlist",
  "visits",
  "appointments",
  "medical_records",
  "pets",
  "customers",
  "escalations",
  "notifications_log",
  "calendar_blocks",
];

const KEPT = ["voice_calls", "call_reviews", "ai_events", "audit_logs", "tomer_prompt_suggestions"];

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count: n, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  if (!error) return n;
  if (isMissingClinicIdColumn(error.message)) {
    console.error(
      `REFUSED: ${table} cannot be safely clinic-scoped (no clinic_id): ${error.message}`,
    );
    process.exit(1);
  }
  return null;
}

async function clinicName() {
  const { data } = await admin.from("clinics").select("name").eq("id", clinicId).maybeSingle();
  return data?.name ?? null;
}

const name = await clinicName();
if (!name) {
  console.error(`No clinic with id ${clinicId} on ${url}.`);
  console.error("Refusing to run: a typo here would look like an empty clinic, not an error.");
  process.exit(1);
}

console.log(`Target: ${url}`);
console.log(`Project ref: ${expectedRef}`);
console.log(`Clinic: ${name} (${clinicId})`);
console.log(confirmed ? "Mode:   DELETE\n" : "Mode:   dry run (pass --confirm to delete)\n");

console.log("Will delete:");
let total = 0;
for (const table of DELETE_ORDER) {
  const n = await count(table);
  if (n === null) {
    console.log(`  ${table.padEnd(20)} — no such table, skipping`);
    continue;
  }
  if (n > 0) console.log(`  ${table.padEnd(20)} ${n}`);
  total += n;
}
console.log(`  ${"".padEnd(20)} ${total} rows total\n`);

console.log("Will keep (this clinic's rows):");
for (const table of KEPT) {
  const n = await count(table);
  if (n !== null) console.log(`  ${table.padEnd(24)} ${n}`);
}

if (!confirmed) {
  console.log("\nDry run — nothing was deleted.");
  process.exit(0);
}

console.log("\nDeleting…");
for (const table of DELETE_ORDER) {
  const { error } = await admin.from(table).delete().eq("clinic_id", clinicId);
  if (error) {
    if (isMissingClinicIdColumn(error.message)) {
      console.error(
        `  ${table.padEnd(20)} REFUSED: ${table} cannot be safely clinic-scoped (no clinic_id)`,
      );
      console.error("\nStopped. Nothing after this table was touched.");
      process.exit(1);
    }
    if (/does not exist/i.test(error.message)) {
      console.log(`  ${table.padEnd(20)} skipped (${error.message})`);
      continue;
    }
    console.error(`  ${table.padEnd(20)} FAILED: ${error.message}`);
    console.error("\nStopped. Nothing after this table was touched.");
    process.exit(1);
  }
  console.log(`  ${table.padEnd(20)} cleared`);
}

console.log("\nAfter:");
for (const table of [...DELETE_ORDER, ...KEPT]) {
  const n = await count(table);
  if (n) console.log(`  ${table.padEnd(24)} ${n}`);
}
console.log("\nDone.");
