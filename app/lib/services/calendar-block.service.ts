import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { CalendarBlockRepository } from "@/lib/repositories/calendar-block.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CalendarBlock,
  CalendarBlockListFilters,
  CreateCalendarBlockInput,
} from "@/types/domain/calendar-block";

function canManageCalendarBlocks(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class CalendarBlockService {
  constructor(private readonly repository: CalendarBlockRepository) {}

  async listBlocks(
    actor: ServiceActor,
    input: Omit<CalendarBlockListFilters, "clinicIds">,
  ): Promise<Result<CalendarBlock[]>> {
    return this.repository.list({
      clinicIds: actor.clinicIds,
      from: input.from,
      to: input.to,
    });
  }

  async createBlock(
    actor: ServiceActor,
    input: CreateCalendarBlockInput,
  ): Promise<Result<CalendarBlock>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create calendar block for requested clinic"));
    }

    if (!canManageCalendarBlocks(actor, input.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage calendar blocks"));
    }

    if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
      return err(AppError.validation("Calendar block end must be after start"));
    }

    return this.repository.create({
      ...input,
      createdBy: actor.userId,
    });
  }

  async deleteBlock(actor: ServiceActor, blockId: string): Promise<Result<void>> {
    const existing = await this.repository.findById(blockId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Calendar block not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Calendar block outside actor clinics"));
    }

    if (!canManageCalendarBlocks(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage calendar blocks"));
    }

    return this.repository.delete(blockId);
  }
}
