import { getActorAndServices } from "@/lib/api/actor";
import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ callId: string }> },
) {
  const requestId = createRequestId();

  try {
    const { callId } = await params;
    const { actor, voiceCall } = await getActorAndServices();

    const callResult = await voiceCall.getCallById(actor, callId);
    if (!callResult.ok) return handleRouteError(callResult.error, requestId);

    const storagePath = callResult.value.recordingStoragePath;
    if (!storagePath) {
      throw AppError.notFound("No recording available for this call");
    }

    // Use admin client for Storage signed URL (bypasses RLS)
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from("call-recordings")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      throw AppError.externalProvider("Failed to generate signed URL", error);
    }

    return jsonSuccess({ url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS }, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
