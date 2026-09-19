import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createVitalSchema } from "@/lib/validators/vital";

type Params = { params: Promise<{ visitId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visit, medicalRecord } = await getActorAndServices();
    const { visitId } = await params;
    const visitResult = await visit.getVisitById(actor, visitId);
    if (!visitResult.ok) return handleRouteError(visitResult.error, requestId);
    const result = await medicalRecord.listVitals(actor, visitResult.value.petId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { visitId } = await params;
    const body = parseOrThrow(createVitalSchema, await request.json());
    const result = await medicalRecord.recordVitals(actor, visitId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
