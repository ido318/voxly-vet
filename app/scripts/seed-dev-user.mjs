/**
 * Local dev helper: creates a test user and owner membership for the seeded clinic.
 *
 * Usage:
 *   node scripts/seed-dev-user.mjs
 *
 * Env (from `supabase status`):
 *   SUPABASE_URL (default http://127.0.0.1:54321)
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clinicId = "00000000-0000-4000-8000-000000000001";
const email = process.env.DEV_USER_EMAIL ?? "owner@demo-clinic.local";
const password = process.env.DEV_USER_PASSWORD ?? "dev-password-change-me";

if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error("listUsers failed:", listError);
  console.error(
    "Hint: check that SUPABASE_SERVICE_ROLE_KEY is set and matches `supabase status` output.",
  );
  process.exit(1);
}

let user = existing.users.find((item) => item.email === email);

if (!user) {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Dev Owner" },
  });
  if (createError) {
    console.error("createUser failed:", createError);
    process.exit(1);
  }
  user = created.user;
} else {
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    user.id,
    {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata ?? {}), full_name: "Dev Owner" },
    },
  );
  if (updateError) {
    console.error("updateUserById failed:", updateError);
    process.exit(1);
  }
  user = updated.user;
}

if (!user) {
  console.error("Failed to create or load dev user (no error returned).");
  process.exit(1);
}

await admin.from("profiles").upsert({
  id: user.id,
  full_name: "Dev Owner",
  default_clinic_id: clinicId,
});

const { error: membershipError } = await admin.from("clinic_memberships").upsert(
  {
    clinic_id: clinicId,
    user_id: user.id,
    role: "owner",
  },
  { onConflict: "clinic_id,user_id" },
);

if (membershipError) {
  console.error("Failed to create membership", membershipError);
  process.exit(1);
}

console.log("Dev user ready:");
console.log(`  email: ${email}`);
console.log(`  clinic_id: ${clinicId}`);
