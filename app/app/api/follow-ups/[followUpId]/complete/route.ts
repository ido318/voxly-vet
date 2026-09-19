import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { completeFollowUpSchema } from "@/lib/validators/follow-up";

type Params = { params: Promise<{ followUpId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, followUp } = await getActorAndServices();
    const { followUpId } = await params;
    const body = parseOrThrow(completeFollowUpSchema, await request.json());
    const result = await followUp.completeFollowUp(actor, followUpId, body.version);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
