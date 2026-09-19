import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createInventoryItemSchema } from "@/lib/validators/inventory";

export async function GET() {
  const requestId = createRequestId();
  try {
    const { actor, inventory } = await getActorAndServices();
    const result = await inventory.listInventory(actor);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { actor, inventory } = await getActorAndServices();
    const body = parseOrThrow(createInventoryItemSchema, await request.json());
    const result = await inventory.createItem(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
