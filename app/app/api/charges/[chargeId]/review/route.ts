import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

type Params = { params: Promise<{ chargeId: string }> };

export async function POST(_: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, visitCharge } = await getActorAndServices();
    const { chargeId } = await params;
    const result = await visitCharge.reviewCharge(actor, chargeId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
