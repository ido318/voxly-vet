import { describe, expect, it, vi } from "vitest";
import { WaitlistService } from "@/lib/services/waitlist.service";
import type { WaitlistRepository } from "@/lib/repositories/waitlist.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const ownerActor: ServiceActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  clinicIds: ["00000000-0000-4000-8000-000000000010"],
  defaultClinicId: "00000000-0000-4000-8000-000000000010",
  memberships: [{ clinicId: "00000000-0000-4000-8000-000000000010", role: "owner" }],
};

function makeRepository(): WaitlistRepository {
  return {
    list: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          id: "wl-1",
          clinicId: ownerActor.defaultClinicId!,
          customerId: "cust-1",
          petId: "pet-1",
          customerName: "דנה כהן",
          customerPhone: "+972501234567",
          petName: "רקס",
          visitType: "vaccination",
          preferredStart: "2026-09-01",
          preferredEnd: "2026-09-10",
          status: "pending",
          notes: null,
          createdAt: "2026-08-20T10:00:00.000Z",
          updatedAt: "2026-08-20T10:00:00.000Z",
        },
      ],
    }),
  } as unknown as WaitlistRepository;
}

describe("WaitlistService", () => {
  it("lists only actor clinics", async () => {
    const repository = makeRepository();
    const service = new WaitlistService(repository);

    const result = await service.listEntries(ownerActor);

    expect(repository.list).toHaveBeenCalledWith({ clinicIds: ownerActor.clinicIds });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.customerName).toBe("דנה כהן");
  });
});
