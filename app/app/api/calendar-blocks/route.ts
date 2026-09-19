import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import {
  createCalendarBlockSchema,
  listCalendarBlocksSchema,
} from "@/lib/validators/calendar-block";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, calendarBlock } = await getActorAndServices();
    const { searchParams } = new URL(request.url);
    const parsed = parseOrThrow(listCalendarBlocksSchema, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    const result = await calendarBlock.listBlocks(actor, parsed);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess({ items: result.value }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const { actor, calendarBlock } = await getActorAndServices();
    const body = parseOrThrow(createCalendarBlockSchema, await request.json());
    const result = await calendarBlock.createBlock(actor, body);
    if (!result.ok) return handleRouteError(result.error, requestId);
    return jsonSuccess(result.value, 201, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
