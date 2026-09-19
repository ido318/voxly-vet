import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { draftSoapSchema } from "@/lib/validators/ai-summary";

export async function POST(request: Request) {
  const requestId = createRequestId();
  try {
    const { actor, aiArtifact } = await getActorAndServices();
    const body = parseOrThrow(draftSoapSchema, await request.json());
    const result = await aiArtifact.generateArtifact(actor, "draft_soap", body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
