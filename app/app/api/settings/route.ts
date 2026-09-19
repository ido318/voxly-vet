import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateClinicSettingsSchema } from "@/lib/validators/clinic-settings";

export async function GET() {
  const requestId = createRequestId();

  try {
    const { actor, clinicSettings } = await getActorAndServices();
    const result = await clinicSettings.getSettings(actor);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, clinicSettings } = await getActorAndServices();
    const body = parseOrThrow(updateClinicSettingsSchema, await request.json());
    const result = await clinicSettings.updateSettings(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
