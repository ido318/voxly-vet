import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import {
  changeStatusSchema,
  deleteAppointmentSchema,
  updateAppointmentSchema,
} from "@/lib/validators/appointment";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();
    const { appointmentId } = await params;
    const result = await appointment.getAppointmentById(actor, appointmentId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();
    const { appointmentId } = await params;
    const body = await request.json();

    if (body.status) {
      const parsed = parseOrThrow(changeStatusSchema, body);
      const result = await appointment.changeStatus(
        actor,
        appointmentId,
        parsed.version,
        {
          status: parsed.status,
          cancellationReason: parsed.cancellationReason ?? null,
        },
      );
      if (!result.ok) return handleRouteError(result.error, requestId);
      return jsonSuccess(result.value, 200, requestId);
    }

    const parsed = parseOrThrow(updateAppointmentSchema, body);
    const result = await appointment.updateAppointment(
      actor,
      appointmentId,
      parsed.version,
      parsed.data,
    );
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();
    const { appointmentId } = await params;
    const body = parseOrThrow(deleteAppointmentSchema, await request.json());
    const result = await appointment.softDelete(actor, appointmentId, body.version);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ deleted: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
