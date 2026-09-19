import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { withClinicSettingsDefaults } from "@/lib/clinic-settings-defaults";
import type { ClinicRepository } from "@/lib/repositories/clinic.repository";
import type { AuditService } from "@/lib/services/audit.service";
import type { ServiceActor } from "@/lib/services/service-context";
import type { ClinicSettings } from "@/types/domain/clinic";
import type { UpdateClinicSettingsInput } from "@/lib/validators/clinic-settings";

function resolveClinicId(actor: ServiceActor, requested?: string): Result<string> {
  const clinicId = requested ?? actor.defaultClinicId ?? actor.clinicIds[0];
  if (!clinicId || !actor.clinicIds.includes(clinicId)) {
    return err(AppError.forbidden("אין לך גישה למרפאה הזו"));
  }
  return ok(clinicId);
}

function canManageSettings(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class ClinicSettingsService {
  constructor(
    private readonly clinicRepository: ClinicRepository,
    private readonly auditService: AuditService,
  ) {}

  async getSettings(
    actor: ServiceActor,
    requestedClinicId?: string,
  ): Promise<Result<ClinicSettings>> {
    const clinicIdResult = resolveClinicId(actor, requestedClinicId);
    if (!clinicIdResult.ok) return clinicIdResult;

    const clinicResult = await this.clinicRepository.findById(clinicIdResult.value);
    if (!clinicResult.ok) return clinicResult;
    if (!clinicResult.value) return err(AppError.notFound("המרפאה לא נמצאה"));

    return ok(clinicResult.value.settings);
  }

  async updateSettings(
    actor: ServiceActor,
    input: UpdateClinicSettingsInput,
    requestedClinicId?: string,
  ): Promise<Result<ClinicSettings>> {
    const clinicIdResult = resolveClinicId(actor, requestedClinicId);
    if (!clinicIdResult.ok) return clinicIdResult;
    const clinicId = clinicIdResult.value;

    if (!canManageSettings(actor, clinicId)) {
      return err(AppError.forbidden("רק בעלים או מנהל יכולים לערוך הגדרות מרפאה"));
    }

    const clinicResult = await this.clinicRepository.findById(clinicId);
    if (!clinicResult.ok) return clinicResult;
    if (!clinicResult.value) return err(AppError.notFound("המרפאה לא נמצאה"));

    const current = clinicResult.value.settings;
    const merged = withClinicSettingsDefaults({
      businessHours: input.businessHours ?? current.businessHours,
      visitPrices: input.visitPrices ?? current.visitPrices,
      contact: { ...current.contact, ...input.contact },
      // Full replace, not a per-key merge — matches how businessHours/visitPrices
      // already behave (a whole new array, not merged item-by-item). The settings
      // UI always sends the complete smsTemplates object it wants to persist.
      smsTemplates: input.smsTemplates ?? current.smsTemplates,
    });

    const updated = await this.clinicRepository.updateSettings(clinicId, merged);
    if (!updated.ok) return updated;

    await this.auditService.logAction({
      clinicId,
      actorType: "user",
      actorId: actor.userId,
      action: "clinic_settings.update",
      entityType: "clinic",
      entityId: clinicId,
      beforePayload: current,
      afterPayload: updated.value.settings,
    });

    return ok(updated.value.settings);
  }
}
