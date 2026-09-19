import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { acceptVisitSummarySchema } from "@/lib/validators/visit-ai-summary";

type Params = { params: Promise<{ visitId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, visitSummaryAssistant } = await getActorAndServices();
    const { visitId } = await params;
    const body = await request.json();
    const parsed = parseOrThrow(acceptVisitSummarySchema, body);

    const result = await visitSummaryAssistant.acceptDraft(
      actor,
      visitId,
      parsed.version,
      parsed.summaryText,
    );
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ visit: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
