import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { PriceListItemRepository } from "@/lib/repositories/price-list-item.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type {
  CreatePriceListItemInput,
  PriceListItem,
  UpdatePriceListItemInput,
} from "@/types/domain/price-list-item";

function canManagePriceList(actor: ServiceActor, clinicId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.clinicId === clinicId &&
      (membership.role === "owner" || membership.role === "admin"),
  );
}

export class PriceListItemService {
  constructor(private readonly repository: PriceListItemRepository) {}

  async listItems(actor: ServiceActor): Promise<Result<PriceListItem[]>> {
    return this.repository.list(actor.clinicIds);
  }

  async createItem(
    actor: ServiceActor,
    input: CreatePriceListItemInput,
  ): Promise<Result<PriceListItem>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot create price list item for requested clinic"));
    }
    if (!canManagePriceList(actor, input.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage the price list"));
    }

    return this.repository.create({ ...input, createdByUserId: actor.userId });
  }

  async updateItem(
    actor: ServiceActor,
    itemId: string,
    input: UpdatePriceListItemInput,
  ): Promise<Result<PriceListItem>> {
    const existing = await this.repository.findById(itemId);
    if (!existing.ok) return existing;
    if (!existing.value) return err(AppError.notFound("Price list item not found"));
    if (!canManagePriceList(actor, existing.value.clinicId)) {
      return err(AppError.forbidden("Only owner or admin can manage the price list"));
    }

    const { version, ...patch } = input;
    return this.repository.updateVersioned(itemId, version, patch);
  }
}
