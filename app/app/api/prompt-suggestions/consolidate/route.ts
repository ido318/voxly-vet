import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function POST() {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);
    const result = await services.promptSuggestion.consolidatePending();
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
