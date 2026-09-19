import { describe, expect, it } from "vitest";
import { buildLabOrderStatusPatch } from "@/lib/services/lab-order.service";

describe("buildLabOrderStatusPatch", () => {
  it("stamps completed_at when moving to completed", () => {
    const patch = buildLabOrderStatusPatch("completed");

    expect(patch.status).toBe("completed");
    expect(patch.completed_at).not.toBeNull();
    expect(new Date(patch.completed_at as string).getTime()).not.toBeNaN();
  });

  it("clears completed_at when reopened to in_progress", () => {
    const patch = buildLabOrderStatusPatch("in_progress");

    expect(patch.status).toBe("in_progress");
    expect(patch.completed_at).toBeNull();
  });

  it("clears completed_at when reset to ordered", () => {
    const patch = buildLabOrderStatusPatch("ordered");

    expect(patch.completed_at).toBeNull();
  });
});
