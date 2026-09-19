import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { addMedicalNoteAddendumSchema } from "@/lib/validators/medical-note";

type Params = { params: Promise<{ visitId: string; noteId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { visitId, noteId } = await params;
    const body = parseOrThrow(addMedicalNoteAddendumSchema, await request.json());
    const result = await medicalRecord.addAddendum(actor, noteId, body, visitId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
