import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { medicalRecordTimelineQuerySchema } from "@/lib/validators/medical-record-timeline";

type Params = { params: Promise<{ petId: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { petId } = await params;
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(medicalRecordTimelineQuerySchema, {
      type: searchParams.get("type") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    const result = await medicalRecord.getTimeline(actor, petId, query);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
