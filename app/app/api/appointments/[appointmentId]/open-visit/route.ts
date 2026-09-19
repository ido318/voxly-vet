import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { appointmentWorkflowActionSchema } from "@/lib/validators/appointment-workflow";

type Params = { params: Promise<{ appointmentId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();
    const { appointmentId } = await params;
    const body = parseOrThrow(appointmentWorkflowActionSchema, await request.json());
    const result = await appointment.openVisitFromAppointment(actor, appointmentId, body.version);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
