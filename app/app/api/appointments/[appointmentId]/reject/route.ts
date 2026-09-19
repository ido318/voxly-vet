import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { z } from "zod";

const rejectSchema = z.object({
  phone: z.string().min(1),
  customerName: z.string().min(1),
  petName: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  const requestId = createRequestId();

  try {
    const { actor, appointment } = await getActorAndServices();

    const hasPrivilegedRole = actor.memberships.some((m) =>
      ["owner", "admin"].includes(m.role),
    );
    if (!hasPrivilegedRole) {
      throw AppError.forbidden("Only owner or admin can reject appointments");
    }

    const { appointmentId } = await params;
    const body = parseOrThrow(rejectSchema, await request.json());
    const result = await appointment.rejectPendingAppointment(actor, appointmentId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    // Appointment fields stay at the top level (unchanged contract); smsStatus is
    // added so the dashboard can report what actually happened to the client SMS.
    return jsonSuccess(
      { ...result.value.appointment, smsStatus: result.value.smsStatus },
      200,
      requestId,
    );
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
