import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { z } from "zod";

const resolveSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const { actor, escalation } = await getActorAndServices();

    const hasPrivilegedRole = actor.memberships.some((m) =>
      ["owner", "admin"].includes(m.role),
    );
    if (!hasPrivilegedRole) {
      throw AppError.forbidden("Only owner or admin can resolve escalations");
    }

    const { id } = await params;
    if (!id) throw AppError.validation("Missing escalation id");
    const body = parseOrThrow(resolveSchema, await request.json());
    const result = await escalation.resolve(actor, id, body.notes);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
