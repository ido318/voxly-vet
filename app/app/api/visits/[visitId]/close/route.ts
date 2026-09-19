import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { closeVisitSchema } from "@/lib/validators/visit-close";

type Params = { params: Promise<{ visitId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const { visitId } = await params;
    const body = parseOrThrow(closeVisitSchema, await request.json());
    const result = await visit.closeVisit(actor, visitId, body.version, body.followUp);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
