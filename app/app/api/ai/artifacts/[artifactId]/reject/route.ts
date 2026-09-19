import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { rejectAiArtifactSchema } from "@/lib/validators/ai-summary";

type Params = { params: Promise<{ artifactId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, aiArtifact } = await getActorAndServices();
    const { artifactId } = await params;
    const body = parseOrThrow(rejectAiArtifactSchema, await request.json());
    const result = await aiArtifact.rejectArtifact(actor, artifactId, body.reason);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
