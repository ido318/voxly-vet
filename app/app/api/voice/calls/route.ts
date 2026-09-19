import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { listVoiceCallsSchema } from "@/lib/validators/voice-call";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, voiceCall } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listVoiceCallsSchema, {
      clinicId: searchParams.get("clinicId") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      petId: searchParams.get("petId") ?? undefined,
      appointmentId: searchParams.get("appointmentId") ?? undefined,
      visitId: searchParams.get("visitId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (parsed.clinicId && !actor.clinicIds.includes(parsed.clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }
    const clinicIds = parsed.clinicId ? [parsed.clinicId] : actor.clinicIds;

    const result = await voiceCall.listCalls(actor, {
      clinicIds,
      customerId: parsed.customerId,
      petId: parsed.petId,
      appointmentId: parsed.appointmentId,
      visitId: parsed.visitId,
      status: parsed.status,
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit,
      offset: parsed.offset,
    });
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
