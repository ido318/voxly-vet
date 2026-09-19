// reset-clinic-data.mjs is the most destructive code in the repo: it deletes
// from 19 tables with the service-role key, which bypasses RLS.
//
// Despite the name, it was not scoped to a clinic. Every delete used
// `.not("id", "is", null)` — a filter that matches every row — so `--confirm`
// wiped every tenant in the database. The dry run was no protection: it
// counted globally too, so the number it printed was the number it would
// delete from everyone.
//
// There is no test harness for the script itself (it is a top-level-await
// .mjs that connects on import), so this asserts the guards by reading it.
// Crude, but it names the exact strings that must not come back, which is
// what a future edit needs to trip over.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/reset-clinic-data.mjs"), "utf8");

describe("reset-clinic-data.mjs guards", () => {
  it("has no unscoped delete filter", () => {
    // The exact shape that deleted across tenants.
    expect(source).not.toMatch(/\.delete\(\)\s*\.not\(/);
  });

  it("scopes every delete to one clinic", () => {
    const deletes = source.match(/\.delete\(\)[^\n;]*/g) ?? [];
    expect(deletes.length).toBeGreaterThan(0);
    for (const call of deletes) {
      expect(call, `unscoped delete: ${call}`).toContain('eq("clinic_id", clinicId)');
    }
  });

  it("scopes the counts too, so the dry run reports what it would really delete", () => {
    const counts = source.match(/count:\s*"exact"[\s\S]{0,160}/g) ?? [];
    expect(counts.length).toBeGreaterThan(0);
    for (const call of counts) {
      expect(call).toContain('eq("clinic_id", clinicId)');
    }
  });

  it("requires --clinic-id and refuses to guess", () => {
    expect(source).toContain("--clinic-id=");
    // Refusing on a missing flag is what keeps a forgotten argument from
    // silently meaning "all clinics".
    expect(source).toMatch(/if \(!clinicId \|\| !UUID_RE\.test\(clinicId\)\)/);
  });

  it("still defaults to a dry run", () => {
    expect(source).toContain('process.argv.includes("--confirm")');
    expect(source).toContain("Dry run — nothing was deleted.");
  });

  it("verifies the clinic exists before deleting anything", () => {
    // A typo in the uuid would otherwise look like an empty clinic — zero
    // rows counted, zero deleted, and a cheerful "Done."
    expect(source).toContain("No clinic with id");
  });
});
