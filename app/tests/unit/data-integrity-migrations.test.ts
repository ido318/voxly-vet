import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("data-integrity migrations", () => {
  it("creates recording buckets idempotently", () => {
    const sql = source("../supabase/migrations/20260919141000_storage_recording_buckets.sql");
    expect(sql).toContain("call-recordings");
    expect(sql).toContain("soap-recordings");
    expect(sql).toContain("where not exists");
    expect(sql).toContain("storage.buckets");
  });

  it("adds inventory adjust RPC and composite item/clinic FK", () => {
    const sql = source("../supabase/migrations/20260919142000_inventory_adjust_rpc_and_item_clinic_fk.sql");
    expect(sql).toContain("adjust_inventory_item");
    expect(sql).toContain("quantity_on_hand = quantity_on_hand + p_quantity_delta");
    expect(sql).toContain("quantity_on_hand + p_quantity_delta >= 0");
    expect(sql).toContain("inventory_transactions_item_clinic_fk");
    expect(sql).toContain("inventory_items_id_clinic_unique");
    expect(sql).not.toContain("payments_invoice_clinic_fk");
  });
});
