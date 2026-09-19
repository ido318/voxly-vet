import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { requireAuth } from "@/lib/api/auth-guard";
import { createServices } from "@/lib/services/factory";

export async function GET() {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireAuth(services.auth);

    const result = await services.auth.getCurrentContext();

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
