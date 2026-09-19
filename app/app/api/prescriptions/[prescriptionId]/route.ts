import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updatePrescriptionSchema } from "@/lib/validators/prescription";

type Params = { params: Promise<{ prescriptionId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { prescriptionId } = await params;
    const body = parseOrThrow(updatePrescriptionSchema, await request.json());
    const result = await medicalRecord.updatePrescription(actor, prescriptionId, body);
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
    const { prescriptionId } = await params;
    const result = await medicalRecord.softDeletePrescription(actor, prescriptionId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
