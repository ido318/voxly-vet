import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { getActorAndServices } from "@/lib/api/actor";
import { customerSearchSchema } from "@/lib/validators/customer";
import { petSearchSchema } from "@/lib/validators/pet";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, customer, pet } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const baseInput = {
      clinicId: searchParams.get("clinicId") ?? undefined,
      q: searchParams.get("q") ?? "",
      limit: searchParams.get("limit") ?? undefined,
    };

    if (entity !== "customers" && entity !== "pets") {
      throw AppError.validation("entity must be customers or pets");
    }

    if (entity === "customers") {
      const parsed = parseOrThrow(customerSearchSchema, baseInput);
      const clinicIds = parsed.clinicId ? [parsed.clinicId] : actor.clinicIds;
      if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
        throw AppError.forbidden("Cannot search requested clinic");
      }

      const result = await customer.listCustomers(actor, {
        clinicIds,
        query: parsed.q,
        pageSize: parsed.limit ?? 25,
        page: 1,
      });

      if (!result.ok) {
        return handleRouteError(result.error, requestId);
      }

      return jsonSuccess({ customers: result.value, pets: [] }, 200, requestId);
    }

    const parsed = parseOrThrow(petSearchSchema, baseInput);
    const clinicIds = parsed.clinicId ? [parsed.clinicId] : actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      throw AppError.forbidden("Cannot search requested clinic");
    }

    const result = await pet.listPets(
      { ...actor, clinicIds },
      undefined,
      parsed.q,
    );
    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess({ customers: [], pets: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
