import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { AppError } from "@/lib/errors/app-error";
import { z } from "zod";

const calendarQuerySchema = z.object({
  clinicId: z.string().uuid(),
  date: z.string().date(),
  view: z.enum(["day", "week"]).default("day"),
});

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, calendar } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(calendarQuerySchema, {
      clinicId: searchParams.get("clinicId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      view: searchParams.get("view") ?? undefined,
    });

    if (!actor.clinicIds.includes(parsed.clinicId)) {
      throw AppError.forbidden("Cannot access requested clinic");
    }

    if (parsed.view === "week") {
      const result = await calendar.listWeek(actor, parsed.clinicId, parsed.date);
      if (!result.ok) return handleRouteError(result.error, requestId);
      return jsonSuccess({ items: result.value, view: "week" }, 200, requestId);
    }

    const result = await calendar.listDay(actor, parsed.clinicId, parsed.date);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value, view: "day" }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
