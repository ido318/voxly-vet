import { z } from "zod";
import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(800),
});

type Params = { params: Promise<{ customerId: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, customerMessage } = await getActorAndServices();
    const { customerId } = await params;
    const input = parseOrThrow(sendMessageSchema, await request.json());

    const result = await customerMessage.sendSmsToCustomer(actor, customerId, input.body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
