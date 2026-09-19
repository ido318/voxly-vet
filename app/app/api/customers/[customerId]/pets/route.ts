import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { getActorAndServices } from "@/lib/api/actor";
import { createPetSchema } from "@/lib/validators/pet";

type Params = { params: Promise<{ customerId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, pet } = await getActorAndServices();
    const { customerId } = await params;
    const result = await pet.listPets(actor, customerId);

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, pet, customer } = await getActorAndServices();
    const { customerId } = await params;
    const ownerCustomer = await customer.getCustomerById(actor, customerId);
    if (!ownerCustomer.ok) {
      return handleRouteError(ownerCustomer.error, requestId);
    }

    const body = parseOrThrow(createPetSchema.omit({ customerId: true }), await request.json());
    const result = await pet.createPet(actor, {
      ...body,
      customerId,
      clinicId: ownerCustomer.value.clinicId,
    });

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
