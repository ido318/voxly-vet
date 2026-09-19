import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createInvoiceSchema, listInvoicesSchema } from "@/lib/validators/invoice";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, invoice } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listInvoicesSchema, {
      customerId: searchParams.get("customerId") ?? undefined,
      petId: searchParams.get("petId") ?? undefined,
    });

    const result = await invoice.listInvoices(actor, parsed);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, invoice } = await getActorAndServices();
    const body = parseOrThrow(createInvoiceSchema, await request.json());
    const result = await invoice.createInvoice(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
