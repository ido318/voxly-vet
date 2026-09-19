import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import type { CallReviewSeverityFilter } from "@/types/domain/call-review";

const VALID_SEVERITIES: CallReviewSeverityFilter[] = ["all", "none", "low", "medium", "high", "critical"];

function parseSeverity(value: string | null): CallReviewSeverityFilter {
  return VALID_SEVERITIES.includes(value as CallReviewSeverityFilter)
    ? (value as CallReviewSeverityFilter)
    : "all";
}

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const services = await createServices();
    await requireProviderAdmin(services.auth);

    const url = new URL(request.url);
    const severity = parseSeverity(url.searchParams.get("severity"));
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const result = await services.callReview.list({ severity, page });
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
