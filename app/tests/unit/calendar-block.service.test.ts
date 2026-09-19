import { describe, expect, it, vi } from "vitest";
import { CalendarBlockService } from "@/lib/services/calendar-block.service";
import type { CalendarBlockRepository } from "@/lib/repositories/calendar-block.repository";
import type { ServiceActor } from "@/lib/services/service-context";

const ownerActor: ServiceActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  clinicIds: ["00000000-0000-4000-8000-000000000010"],
  defaultClinicId: "00000000-0000-4000-8000-000000000010",
  memberships: [{ clinicId: "00000000-0000-4000-8000-000000000010", role: "owner" }],
};

function makeRepository(): CalendarBlockRepository {
  return {
    list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    findById: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: "block-1",
        clinicId: ownerActor.defaultClinicId!,
        startAt: "2026-06-22T12:00:00+03:00",
        endAt: "2026-06-22T20:00:00+03:00",
        reason: "סיום מוקדם",
        createdBy: ownerActor.userId,
        createdAt: "2026-06-19T18:00:00.000Z",
      },
    }),
    create: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: "block-1",
        clinicId: ownerActor.defaultClinicId!,
        startAt: "2026-06-22T12:00:00+03:00",
        endAt: "2026-06-22T20:00:00+03:00",
        reason: "סיום מוקדם",
        createdBy: ownerActor.userId,
        createdAt: "2026-06-19T18:00:00.000Z",
      },
    }),
    delete: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as CalendarBlockRepository;
}

describe("CalendarBlockService", () => {
  it("lists only actor clinics", async () => {
    const repository = makeRepository();
    const service = new CalendarBlockService(repository);

    await service.listBlocks(ownerActor, {
      from: "2026-06-22T00:00:00+03:00",
      to: "2026-06-28T23:59:00+03:00",
    });

    expect(repository.list).toHaveBeenCalledWith({
      clinicIds: ownerActor.clinicIds,
      from: "2026-06-22T00:00:00+03:00",
      to: "2026-06-28T23:59:00+03:00",
    });
  });

  it("allows owners to create blocks in their clinic", async () => {
    const repository = makeRepository();
    const service = new CalendarBlockService(repository);

    const result = await service.createBlock(ownerActor, {
      clinicId: ownerActor.defaultClinicId!,
      startAt: "2026-06-22T12:00:00+03:00",
      endAt: "2026-06-22T20:00:00+03:00",
      reason: "סיום מוקדם",
    });

    expect(result.ok).toBe(true);
    expect(repository.create).toHaveBeenCalledWith({
      clinicId: ownerActor.defaultClinicId!,
      startAt: "2026-06-22T12:00:00+03:00",
      endAt: "2026-06-22T20:00:00+03:00",
      reason: "סיום מוקדם",
      createdBy: ownerActor.userId,
    });
  });

  it("rejects staff create requests", async () => {
    const repository = makeRepository();
    const service = new CalendarBlockService(repository);
    const staffActor: ServiceActor = {
      ...ownerActor,
      memberships: [{ clinicId: ownerActor.defaultClinicId!, role: "staff" }],
    };

    const result = await service.createBlock(staffActor, {
      clinicId: ownerActor.defaultClinicId!,
      startAt: "2026-06-22T12:00:00+03:00",
      endAt: "2026-06-22T20:00:00+03:00",
      reason: null,
    });

    expect(result.ok).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects delete when owner role belongs to a different clinic than the block", async () => {
    const repository = makeRepository();
    const service = new CalendarBlockService(repository);
    const mixedActor: ServiceActor = {
      userId: "00000000-0000-4000-8000-000000000002",
      clinicIds: [
        ownerActor.defaultClinicId!,
        "00000000-0000-4000-8000-000000000099",
      ],
      defaultClinicId: ownerActor.defaultClinicId!,
      memberships: [
        { clinicId: ownerActor.defaultClinicId!, role: "staff" },
        { clinicId: "00000000-0000-4000-8000-000000000099", role: "owner" },
      ],
    };

    const result = await service.deleteBlock(mixedActor, "block-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
