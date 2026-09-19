import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createLabOrderSchema, listLabOrdersSchema } from "@/lib/validators/lab-order";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, labOrder } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listLabOrdersSchema, {
      petId: searchParams.get("petId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const result = await labOrder.listLabOrders(actor, parsed);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, labOrder } = await getActorAndServices();
    const body = parseOrThrow(createLabOrderSchema, await request.json());
    const result = await labOrder.createLabOrder(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
