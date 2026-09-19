import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateInvoiceStatusSchema } from "@/lib/validators/invoice";

type Params = { params: Promise<{ invoiceId: string }> };

export async function GET(_: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, invoice } = await getActorAndServices();
    const { invoiceId } = await params;
    const result = await invoice.getInvoiceById(actor, invoiceId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, invoice } = await getActorAndServices();
    const { invoiceId } = await params;
    const body = parseOrThrow(updateInvoiceStatusSchema, await request.json());
    const result = await invoice.updateStatus(actor, invoiceId, body.version, body.status);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
