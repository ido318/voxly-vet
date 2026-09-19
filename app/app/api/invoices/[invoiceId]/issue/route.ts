import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { z } from "zod";

type Params = { params: Promise<{ invoiceId: string }> };

const issueInvoiceSchema = z.object({
  version: z.number().int().min(0),
});

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { actor, invoice } = await getActorAndServices();
    const { invoiceId } = await params;
    const body = parseOrThrow(issueInvoiceSchema, await request.json());
    const result = await invoice.updateStatus(actor, invoiceId, body.version, "sent");
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
