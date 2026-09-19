import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { getActorAndServices } from "@/lib/api/actor";
import { updateCustomerSchema } from "@/lib/validators/customer";

type Params = { params: Promise<{ customerId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, customer } = await getActorAndServices();
    const { customerId } = await params;
    const result = await customer.getCustomerById(actor, customerId);

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, customer } = await getActorAndServices();
    const { customerId } = await params;
    const body = parseOrThrow(updateCustomerSchema, await request.json());
    const result = await customer.updateCustomer(actor, customerId, body);

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, customer } = await getActorAndServices();
    const { customerId } = await params;
    const result = await customer.softDeleteCustomer(actor, customerId);

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
