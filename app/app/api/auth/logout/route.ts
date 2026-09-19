import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { createServices } from "@/lib/services/factory";

export async function POST() {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    const result = await services.auth.signOut();

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess({ signedOut: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
