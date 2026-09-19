import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { getActorAndServices } from "@/lib/api/actor";
import { customerSearchSchema, createCustomerSchema } from "@/lib/validators/customer";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, customer } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(customerSearchSchema.partial(), {
      clinicId: searchParams.get("clinicId") ?? undefined,
      q: searchParams.get("q") ?? searchParams.get("query") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const clinicIds = parsed.clinicId ? [parsed.clinicId] : actor.clinicIds;
    if (clinicIds.some((clinicId) => !actor.clinicIds.includes(clinicId))) {
      throw AppError.forbidden("Cannot access requested clinic");
    }

    const result = await customer.listCustomers(actor, {
      clinicIds,
      query: parsed.q,
      pageSize: parsed.limit,
      page: 1,
    });

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, customer } = await getActorAndServices();
    const body = parseOrThrow(createCustomerSchema, await request.json());
    const result = await customer.createCustomer(actor, body);

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
