import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

type Params = { params: Promise<{ artifactId: string }> };

export async function POST(_: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, aiArtifact } = await getActorAndServices();
    const { artifactId } = await params;
    const result = await aiArtifact.approveArtifact(actor, artifactId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
