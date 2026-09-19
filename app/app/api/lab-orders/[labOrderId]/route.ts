import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateLabOrderSchema } from "@/lib/validators/lab-order";

type Params = { params: Promise<{ labOrderId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, labOrder } = await getActorAndServices();
    const { labOrderId } = await params;
    const body = parseOrThrow(updateLabOrderSchema, await request.json());
    const { version, ...patch } = body;
    const result = await labOrder.updateLabOrder(actor, labOrderId, version, patch);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
