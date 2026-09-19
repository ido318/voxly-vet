import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

type Params = { params: Promise<{ visitId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visitShare } = await getActorAndServices();
    const { visitId } = await params;
    const result = await visitShare.createAndSend(actor, visitId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
