import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { linkVoiceCallSchema } from "@/lib/validators/voice-call";

export async function GET(
  _request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const requestId = createRequestId();

  try {
    const { callId } = await context.params;
    const { actor, voiceCall } = await getActorAndServices();
    const result = await voiceCall.getCallById(actor, callId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const requestId = createRequestId();

  try {
    const { callId } = await context.params;
    const { actor, voiceCall } = await getActorAndServices();
    const body = parseOrThrow(linkVoiceCallSchema, await request.json());
    const result = await voiceCall.linkCall(actor, callId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
