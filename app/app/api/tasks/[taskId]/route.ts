import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { updateTaskSchema } from "@/lib/validators/task";

type Params = { params: Promise<{ taskId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = createRequestId();

  try {
    const { actor, task } = await getActorAndServices();
    const { taskId } = await params;
    const body = parseOrThrow(updateTaskSchema, await request.json());
    const { version, ...patch } = body;
    const result = await task.updateTask(actor, taskId, version, patch);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
