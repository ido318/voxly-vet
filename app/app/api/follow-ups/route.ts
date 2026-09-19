import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createFollowUpSchema, listFollowUpsSchema } from "@/lib/validators/follow-up";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, followUp } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listFollowUpsSchema, {
      status: searchParams.get("status") ?? undefined,
    });
    const result = await followUp.listFollowUps(actor, parsed);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, followUp } = await getActorAndServices();
    const body = parseOrThrow(createFollowUpSchema, await request.json());
    const result = await followUp.createFollowUp(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
