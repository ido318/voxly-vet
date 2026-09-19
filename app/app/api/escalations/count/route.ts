import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET() {
  const requestId = createRequestId();

  try {
    const { actor, escalation } = await getActorAndServices();
    const result = await escalation.countOpen(actor.clinicIds);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ count: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
