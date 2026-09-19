import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createInvoiceFromVisitSchema } from "@/lib/validators/visit-charge";

type Params = { params: Promise<{ visitId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, visitCharge } = await getActorAndServices();
    const { visitId } = await params;
    const body = parseOrThrow(createInvoiceFromVisitSchema, await request.json());
    const result = await visitCharge.createInvoiceFromVisit(actor, visitId, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
