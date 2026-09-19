import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { getActorAndServices } from "@/lib/api/actor";
import { updatePetSchema } from "@/lib/validators/pet";

type Params = { params: Promise<{ petId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, pet } = await getActorAndServices();
    const { petId } = await params;
    const result = await pet.getPetById(actor, petId);
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
    const { actor, pet } = await getActorAndServices();
    const { petId } = await params;
    const body = parseOrThrow(updatePetSchema, await request.json());
    const result = await pet.updatePet(actor, petId, body);
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
    const { actor, pet } = await getActorAndServices();
    const { petId } = await params;
    const result = await pet.softDeletePet(actor, petId);
    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
