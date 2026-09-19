import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { InventoryRepository } from "@/lib/repositories/inventory.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreateInventoryItemInput,
  InventoryAdjustmentInput,
  InventoryItem,
} from "@/types/domain/inventory";

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async listInventory(actor: ServiceActor): Promise<Result<InventoryItem[]>> {
    return this.repository.list(actor.clinicIds);
  }

  async createItem(actor: ServiceActor, input: CreateInventoryItemInput): Promise<Result<InventoryItem>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create inventory item for requested clinic"));
    }
    return this.repository.create({ ...input, createdByUserId: actor.userId });
  }

  async adjustItem(
    actor: ServiceActor,
    itemId: string,
    input: InventoryAdjustmentInput & { clinicId: string },
  ): Promise<Result<InventoryItem>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot adjust inventory item for requested clinic"));
    }
    return this.repository.adjust(itemId, { ...input, createdByUserId: actor.userId });
  }
}
