import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateMedicalNoteSchema } from "@/lib/validators/medical-note";

type Params = { params: Promise<{ visitId: string; noteId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { visitId, noteId } = await params;
    const body = parseOrThrow(updateMedicalNoteSchema, await request.json());
    const result = await medicalRecord.updateNote(actor, noteId, body, visitId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
