import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { availabilitySchema } from "@/lib/validators/appointment";
import { AppError } from "@/lib/errors/app-error";
import { BOOKING_WINDOW_DAYS, isWithinBookingWindow } from "@/lib/appointment-rules";
import { ISRAEL_TIMEZONE } from "@tomer/shared";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, calendar } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(availabilitySchema, {
      clinicId: searchParams.get("clinicId"),
      date: searchParams.get("date"),
      visitType: searchParams.get("visitType") ?? undefined,
    });
    if (!actor.clinicIds.includes(parsed.clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }
    // The 14-day window used to be a client-rendering convention only — this
    // route happily returned slots for any date it was asked about.
    if (!isWithinBookingWindow(parsed.date)) {
      throw AppError.validation(
        `ניתן לקבוע תורים עד ${BOOKING_WINDOW_DAYS} יום קדימה בלבד`,
      );
    }

    const result = await calendar.availabilityByDate(
      actor,
      parsed.clinicId,
      parsed.date,
      ISRAEL_TIMEZONE,
      parsed.visitType,
    );
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
