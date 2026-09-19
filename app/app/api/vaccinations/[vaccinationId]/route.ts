import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateVaccinationSchema } from "@/lib/validators/vaccination";

type Params = { params: Promise<{ vaccinationId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { vaccinationId } = await params;
    const body = parseOrThrow(updateVaccinationSchema, await request.json());
    const result = await medicalRecord.updateVaccination(actor, vaccinationId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { vaccinationId } = await params;
    const result = await medicalRecord.softDeleteVaccination(actor, vaccinationId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
