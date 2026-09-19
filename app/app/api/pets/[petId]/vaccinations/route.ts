import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { createVaccinationSchema } from "@/lib/validators/vaccination";
import { z } from "zod";

type Params = { params: Promise<{ petId: string }> };

const listVaccinationsSchema = z.object({
  clinicId: z.string().uuid(),
});

export async function GET(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { petId } = await params;
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listVaccinationsSchema, {
      clinicId: searchParams.get("clinicId"),
    });

    if (!actor.clinicIds.includes(parsed.clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }

    const result = await medicalRecord.listPetVaccinations(actor, petId, parsed.clinicId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, medicalRecord } = await getActorAndServices();
    const { petId } = await params;
    const body = parseOrThrow(createVaccinationSchema, await request.json());
    const result = await medicalRecord.recordVaccination(actor, petId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
