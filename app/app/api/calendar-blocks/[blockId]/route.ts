import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ blockId: string }> },
) {
  const requestId = createRequestId();

  try {
    const { blockId } = await context.params;
    const { actor, calendarBlock } = await getActorAndServices();
    const result = await calendarBlock.deleteBlock(actor, blockId);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ ok: true }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
