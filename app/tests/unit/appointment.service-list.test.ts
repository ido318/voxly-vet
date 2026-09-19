import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { AppointmentService } from "@/lib/services/appointment.service";
import type { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { PetRepository } from "@/lib/repositories/pet.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";

describe("AppointmentService.listAppointments", () => {
  it("translates a date filter into Israel day bounds so dashboard day views only load that day", async () => {
    const list = vi.fn().mockResolvedValue(ok([]));
    const service = new AppointmentService(
      { list } as unknown as AppointmentRepository,
      {} as CustomerRepository,
      {} as PetRepository,
      {} as AuditService,
    );
    const actor: ServiceActor = {
      userId: "user-1",
      clinicIds: ["00000000-0000-4000-8000-000000000001"],
      defaultClinicId: "00000000-0000-4000-8000-000000000001",
      memberships: [{ clinicId: "00000000-0000-4000-8000-000000000001", role: "owner" }],
    };

    const result = await service.listAppointments(actor, {
      date: "2026-06-21",
    });

    expect(result.ok).toBe(true);
    expect(list).toHaveBeenCalledWith({
      clinicIds: actor.clinicIds,
      date: undefined,
      from: "2026-06-20T21:00:00.000Z",
      to: "2026-06-21T21:00:00.000Z",
    });
  });
});
