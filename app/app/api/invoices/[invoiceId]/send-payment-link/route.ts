import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

type Params = { params: Promise<{ invoiceId: string }> };

export async function POST(_: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, invoice } = await getActorAndServices();
    const { invoiceId } = await params;
    const result = await invoice.sendPaymentLink(actor, invoiceId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
