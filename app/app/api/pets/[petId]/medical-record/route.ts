import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateMedicalRecordSchema } from "@/lib/validators/medical-record";

type Params = { params: Promise<{ petId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { petId } = await params;
    const result = await medicalRecord.getRecordByPet(actor, petId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ item: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { petId } = await params;
    const body = parseOrThrow(updateMedicalRecordSchema, await request.json());
    const result = await medicalRecord.updateRecordByPet(actor, petId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ item: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
