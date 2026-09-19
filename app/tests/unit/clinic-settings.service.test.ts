import { describe, expect, it, vi } from "vitest";
import { ClinicSettingsService } from "@/lib/services/clinic-settings.service";
import type { ClinicRepository } from "@/lib/repositories/clinic.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Clinic } from "@/types/domain/clinic";
import { DEFAULT_CLINIC_SETTINGS } from "@/lib/clinic-settings-defaults";

const clinicId = "00000000-0000-4000-8000-000000000010";

const ownerActor: ServiceActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  clinicIds: [clinicId],
  defaultClinicId: clinicId,
  memberships: [{ clinicId, role: "owner" }],
};

const staffActor: ServiceActor = {
  ...ownerActor,
  memberships: [{ clinicId, role: "staff" }],
};

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: clinicId,
    name: "Demo Vet Clinic",
    slug: "get-a-vet",
    timezone: "Asia/Jerusalem",
    settings: DEFAULT_CLINIC_SETTINGS,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makeRepository(clinic: Clinic): ClinicRepository {
  return {
    findById: vi.fn().mockResolvedValue({ ok: true, value: clinic }),
    updateSettings: vi.fn().mockImplementation((_id: string, settings) =>
      Promise.resolve({ ok: true, value: { ...clinic, settings } }),
    ),
    findMembershipsByUserId: vi.fn(),
  } as unknown as ClinicRepository;
}

function makeAuditService(): AuditService {
  return { logAction: vi.fn().mockResolvedValue({ ok: true, value: {} }) } as unknown as AuditService;
}

describe("ClinicSettingsService", () => {
  it("returns the clinic's settings for any member", async () => {
    const repository = makeRepository(makeClinic());
    const service = new ClinicSettingsService(repository, makeAuditService());

    const result = await service.getSettings(staffActor);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(DEFAULT_CLINIC_SETTINGS);
  });

  it("rejects settings updates from staff", async () => {
    const repository = makeRepository(makeClinic());
    const service = new ClinicSettingsService(repository, makeAuditService());

    const result = await service.updateSettings(staffActor, {
      contact: { address: "כתובת חדשה", whatsapp: "", email: "" },
    });

    expect(result.ok).toBe(false);
    expect(repository.updateSettings).not.toHaveBeenCalled();
  });

  it("lets owners update settings and merges with existing values", async () => {
    const repository = makeRepository(makeClinic());
    const auditService = makeAuditService();
    const service = new ClinicSettingsService(repository, auditService);

    const result = await service.updateSettings(ownerActor, {
      contact: { address: "רחוב חדש 1", whatsapp: "", email: "" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contact.address).toBe("רחוב חדש 1");
      expect(result.value.businessHours).toEqual(DEFAULT_CLINIC_SETTINGS.businessHours);
    }
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "clinic_settings.update", clinicId }),
    );
  });

  it("rejects requests for a clinic the actor doesn't belong to", async () => {
    const repository = makeRepository(makeClinic());
    const service = new ClinicSettingsService(repository, makeAuditService());

    const result = await service.getSettings(ownerActor, "00000000-0000-4000-8000-000000000099");

    expect(result.ok).toBe(false);
  });

  it("replaces smsTemplates wholesale (not a per-key merge) when input.smsTemplates is given", async () => {
    const repository = makeRepository(
      makeClinic({
        settings: {
          ...DEFAULT_CLINIC_SETTINGS,
          smsTemplates: { booking_confirmation: "old text {{customerName}}" },
        },
      }),
    );
    const service = new ClinicSettingsService(repository, makeAuditService());

    const result = await service.updateSettings(ownerActor, {
      smsTemplates: { cancellation_update: "new text {{oldDate}}" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsTemplates).toEqual({ cancellation_update: "new text {{oldDate}}" });
  });

  it("keeps the existing smsTemplates unchanged when input.smsTemplates is omitted", async () => {
    const existing = { booking_confirmation: "old text {{customerName}}" };
    const repository = makeRepository(
      makeClinic({
        settings: {
          ...DEFAULT_CLINIC_SETTINGS,
          smsTemplates: existing,
        },
      }),
    );
    const service = new ClinicSettingsService(repository, makeAuditService());

    const result = await service.updateSettings(ownerActor, {
      contact: { address: "כתובת חדשה", whatsapp: "", email: "" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.smsTemplates).toEqual(existing);
  });
});
