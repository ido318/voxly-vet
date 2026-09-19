import { describe, expect, it, vi } from "vitest";
import { VisitShareRepository } from "@/lib/repositories/visit-share.repository";

describe("VisitShareRepository.recordView", () => {
  it("increments view_count in SQL via rpc, not a read-modify-write", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn();
    const repo = new VisitShareRepository({ rpc, from } as never);

    await repo.recordView("share-1");
    await repo.recordView("share-1", 7);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("increment_visit_share_view", { p_share_id: "share-1" });
    expect(from).not.toHaveBeenCalled();
  });
});
