import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { deleteVisitSchema, updateVisitSchema } from "@/lib/validators/visit";

type Params = { params: Promise<{ visitId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const { visitId } = await params;
    const result = await visit.getVisitById(actor, visitId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const { visitId } = await params;
    const body = await request.json();
    const parsed = parseOrThrow(updateVisitSchema, body);

    if (parsed.status) {
      const result = await visit.changeVisitStatus(actor, visitId, parsed.version, {
        status: parsed.status,
      });
      if (!result.ok) return handleRouteError(result.error, requestId);
      return jsonSuccess(result.value, 200, requestId);
    }

    const result = await visit.updateVisit(actor, visitId, parsed.version, parsed.data ?? {});
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const { visitId } = await params;
    const body = await request.json();
    const parsed = parseOrThrow(deleteVisitSchema, body);
    const result = await visit.softDeleteVisit(actor, visitId, parsed.version);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
