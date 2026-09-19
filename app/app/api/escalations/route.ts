import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { z } from "zod";

const listEscalationsSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
});

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, escalation } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listEscalationsSchema, {
      status: searchParams.get("status") ?? undefined,
    });

    const result = await escalation.listForClinics(
      actor.clinicIds,
      parsed.status,
    );
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
