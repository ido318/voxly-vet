import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { AppError } from "@/lib/errors/app-error";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);
    const { id } = await params;

    const result = await services.callReview.getWithLinkedSuggestion(id);
    if (!result.ok) return handleRouteError(result.error, requestId);
    if (!result.value) return handleRouteError(AppError.notFound("Call review not found"), requestId);

    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
