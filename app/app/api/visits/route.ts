import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { createVisitSchema, listVisitsSchema } from "@/lib/validators/visit";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listVisitsSchema, {
      clinicId: searchParams.get("clinicId") ?? undefined,
      petId: searchParams.get("petId") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
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

    const result = await visit.listVisits(actor, {
      clinicIds,
      petId: parsed.petId,
      customerId: parsed.customerId,
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

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, visit } = await getActorAndServices();
    const body = parseOrThrow(createVisitSchema, await request.json());
    const result = await visit.createVisit(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
