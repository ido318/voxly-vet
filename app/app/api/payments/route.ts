import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { recordPaymentSchema } from "@/lib/validators/payment";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { actor, payment } = await getActorAndServices();
    const body = parseOrThrow(recordPaymentSchema, await request.json());
    const result = await payment.recordPayment(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
