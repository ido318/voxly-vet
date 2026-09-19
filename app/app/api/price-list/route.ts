import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createPriceListItemSchema } from "@/lib/validators/price-list-item";

export async function GET() {
  const requestId = createRequestId();

  try {
    const { actor, priceListItem } = await getActorAndServices();
    const result = await priceListItem.listItems(actor);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, priceListItem } = await getActorAndServices();
    const body = parseOrThrow(createPriceListItemSchema, await request.json());
    const result = await priceListItem.createItem(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
