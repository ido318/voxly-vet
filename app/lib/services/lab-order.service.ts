import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { LabOrderRepository } from "@/lib/repositories/lab-order.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateLabOrderInput,
  LabOrder,
  LabOrderListFilters,
  LabOrderStatus,
} from "@/types/domain/lab-order";

// completed_at must track status exactly - stamped when moving to
// "completed", and cleared if the order is later reopened (redo/mistake
// correction), so a non-completed order never carries a stale "completed at"
// timestamp from a previous cycle.
export function buildLabOrderStatusPatch(
  status: LabOrderStatus,
): { status: LabOrderStatus; completed_at: string | null } {
  return {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };
}

export class LabOrderService {
  constructor(private readonly repository: LabOrderRepository) {}

  async listLabOrders(
    actor: ServiceActor,
    input: Omit<LabOrderListFilters, "clinicIds">,
  ): Promise<Result<LabOrder[]>> {
    return this.repository.list({ clinicIds: actor.clinicIds, ...input });
  }

  async createLabOrder(actor: ServiceActor, input: CreateLabOrderInput): Promise<Result<LabOrder>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create lab order for requested clinic"));
    }
    return this.repository.create({ ...input, orderedByUserId: actor.userId });
  }

  async updateLabOrder(
    actor: ServiceActor,
    labOrderId: string,
    expectedVersion: number,
    patch: { status?: LabOrderStatus; resultText?: string | null; flagged?: boolean },
  ): Promise<Result<LabOrder>> {
    const existing = await this.repository.findById(labOrderId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Lab order not found"));
    if (!actor.clinicIds.includes(existing.value.clinicId)) {
      return err(AppError.forbidden("Lab order outside actor clinics"));
    }

    const columnPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      if (patch.status === "completed") {
        const resultText = patch.resultText ?? existing.value.resultText;
        if (!resultText?.trim()) {
          return err(AppError.validation("Lab result text is required before completing the lab order"));
        }
      }
      Object.assign(columnPatch, buildLabOrderStatusPatch(patch.status));
    }
    if (patch.resultText !== undefined) columnPatch.result_text = patch.resultText;
    if (patch.flagged !== undefined) columnPatch.flagged = patch.flagged;

    return this.repository.updateVersioned(labOrderId, expectedVersion, columnPatch);
  }
}
