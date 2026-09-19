/**
 * Puts the clinic's two logins into their intended state:
 *
 *   vet@example-vet.com     owner   — Dr. Dana, the vet who runs the day
 *   admin@example-vet.com   admin   — operator account, for agent tuning and triage
 *
 * Updates the accounts already in the project rather than creating new ones, so
 * the rows that point at them (escalations.resolved_by, medical note approvals,
 * audit_logs.actor) keep resolving to a real user instead of dangling.
 *
 * Passwords come from the environment and are never written to disk or logged.
 * Pick them yourself; this script only applies them.
 *
 * Note: 'owner' and 'admin' currently grant identical permissions everywhere in
 * the app (every check reads `role === "owner" || role === "admin"`). The split
 * is recorded here for when the two are actually distinguished.
 *
 * Usage:
 *   NOA_PASSWORD=… ADMIN_PASSWORD=… node scripts/setup-clinic-users.mjs
 *   …                                node scripts/setup-clinic-users.mjs --confirm
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
 *   NOA_PASSWORD, ADMIN_PASSWORD              (required for --confirm)
 *   CLINIC_ID                                 (optional; defaults to the only clinic)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmed = process.argv.includes("--confirm");

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

/** currentEmail is who to find; the rest is what they become. */
const USERS = [
  {
    currentEmail: "vet-old@example-vet.com",
    email: "vet@example-vet.com",
    role: "owner",
    fullName: "ד״ר דנה כהן",
    password: process.env.NOA_PASSWORD,
    passwordVar: "NOA_PASSWORD",
  },
  {
    currentEmail: "admin-old@example-vet.com",
    email: "admin@example-vet.com",
    role: "admin",
    fullName: "עידו אמסלם",
    password: process.env.ADMIN_PASSWORD,
    passwordVar: "ADMIN_PASSWORD",
  },
];

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Target: ${url}`);
console.log(confirmed ? "Mode:   APPLY\n" : "Mode:   dry run (pass --confirm to apply)\n");

if (confirmed) {
  const missing = USERS.filter((u) => !u.password).map((u) => u.passwordVar);
  if (missing.length) {
    console.error(`Missing password env var(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  const tooShort = USERS.filter((u) => u.password.length < 12).map((u) => u.passwordVar);
  if (tooShort.length) {
    console.error(`Password too short (min 12 chars): ${tooShort.join(", ")}`);
    process.exit(1);
  }
}

let clinicId = process.env.CLINIC_ID;
if (!clinicId) {
  const { data, error } = await admin.from("clinics").select("id, name");
  if (error || !data?.length) {
    console.error("Could not read clinics:", error?.message ?? "none found");
    process.exit(1);
  }
  if (data.length > 1) {
    console.error("More than one clinic — set CLINIC_ID explicitly:");
    for (const c of data) console.error(`  ${c.id}  ${c.name}`);
    process.exit(1);
  }
  clinicId = data[0].id;
  console.log(`Clinic: ${data[0].name} (${clinicId})\n`);
}

const { data: existing, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}

for (const spec of USERS) {
  const found =
    existing.users.find((u) => u.email === spec.currentEmail) ??
    existing.users.find((u) => u.email === spec.email);

  if (!found) {
    console.error(`  ${spec.email.padEnd(24)} no account matching ${spec.currentEmail} — skipping`);
    console.error("    (create it in the Supabase dashboard, then re-run)");
    continue;
  }

  const rename = found.email !== spec.email ? `${found.email} → ${spec.email}` : spec.email;
  console.log(`  ${rename}`);
  console.log(`    role: ${spec.role}, password: ${confirmed ? "reset" : "would reset"}`);

  if (!confirmed) continue;

  const { error: updateError } = await admin.auth.admin.updateUserById(found.id, {
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: { ...(found.user_metadata ?? {}), full_name: spec.fullName },
  });
  if (updateError) {
    console.error(`    FAILED: ${updateError.message}`);
    process.exit(1);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: found.id, full_name: spec.fullName, default_clinic_id: clinicId });
  if (profileError) {
    console.error(`    profile FAILED: ${profileError.message}`);
    process.exit(1);
  }

  const { error: membershipError } = await admin
    .from("clinic_memberships")
    .upsert({ clinic_id: clinicId, user_id: found.id, role: spec.role }, { onConflict: "clinic_id,user_id" });
  if (membershipError) {
    console.error(`    membership FAILED: ${membershipError.message}`);
    process.exit(1);
  }

  console.log("    applied");
}

if (!confirmed) {
  console.log("\nDry run — nothing was changed.");
  process.exit(0);
}

const { data: after } = await admin.auth.admin.listUsers();
console.log("\nAccounts now:");
for (const u of after.users) {
  const { data: m } = await admin
    .from("clinic_memberships")
    .select("role")
    .eq("user_id", u.id)
    .maybeSingle();
  console.log(`  ${(u.email ?? "?").padEnd(26)} ${m?.role ?? "no membership"}`);
}
console.log("\nDone.");
