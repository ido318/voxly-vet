import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/reset-clinic-data.mjs"), "utf8");

describe("reset-clinic-data extra H7 guards", () => {
  it("requires project-ref confirmation matching SUPABASE_URL", () => {
    expect(source).toContain("--project-ref=");
    expect(source).toContain("SUPABASE_PROJECT_REF");
    expect(source).toContain("extractProjectRef");
    expect(source).toContain("Project ref mismatch");
    expect(source).toMatch(/projectRefConfirm !== expectedRef/);
  });

  it("accepts CLINIC_ID env as a fallback for --clinic-id", () => {
    expect(source).toContain("process.env.CLINIC_ID");
    expect(source).toContain("--clinic-id=");
    expect(source).toMatch(/if \(!clinicId \|\| !UUID_RE\.test\(clinicId\)\)/);
  });

  it("refuses tables that cannot be clinic-scoped", () => {
    expect(source).toContain("isMissingClinicIdColumn");
    expect(source).toContain("cannot be safely clinic-scoped");
    expect(source).toContain("process.exit(1)");
  });

  it("keeps clinic-id equality on deletes and counts", () => {
    expect(source).not.toMatch(/\.delete\(\)\s*\.not\(/);
    expect(source).toContain('.delete().eq("clinic_id", clinicId)');
    expect(source).toContain('.eq("clinic_id", clinicId)');
  });
});
