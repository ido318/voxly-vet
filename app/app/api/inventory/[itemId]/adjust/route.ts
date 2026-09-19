import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { inventoryAdjustmentSchema } from "@/lib/validators/inventory";

type Params = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, inventory } = await getActorAndServices();
    const { itemId } = await params;
    const body = parseOrThrow(inventoryAdjustmentSchema, await request.json());
    const result = await inventory.adjustItem(actor, itemId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
