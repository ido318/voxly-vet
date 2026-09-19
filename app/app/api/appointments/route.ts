import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import {
  createAppointmentSchema,
  listAppointmentsSchema,
} from "@/lib/validators/appointment";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listAppointmentsSchema, {
      clinicId: searchParams.get("clinicId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      petId: searchParams.get("petId") ?? undefined,
    });

    if (parsed.clinicId && !actor.clinicIds.includes(parsed.clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }
    const clinicIds = parsed.clinicId ? [parsed.clinicId] : actor.clinicIds;

    const result = await appointment.listAppointments(actor, {
      clinicIds,
      date: parsed.date,
      from: parsed.from,
      to: parsed.to,
      status: parsed.status,
      customerId: parsed.customerId,
      petId: parsed.petId,
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
    const { actor, appointment } = await getActorAndServices();
    const body = parseOrThrow(createAppointmentSchema, await request.json());
    const result = await appointment.createAppointment(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
