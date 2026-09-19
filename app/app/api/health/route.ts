import { createRequestId } from "@/lib/api/request-id";
import { handleRouteError, jsonSuccess } from "@/lib/api/response";
import { createAdminServices } from "@/lib/services/factory";
import { timingSafeEqual } from "node:crypto";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

function isTrustedHealthSource(request: Request): boolean {
  const allowed = (process.env.HEALTH_CHECK_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    return true;
  }

  const clientIp = getClientIp(request);
  return allowed.includes(clientIp);
}

function canReadDetailedHealth(request: Request): boolean {
  if (!isTrustedHealthSource(request)) {
    return false;
  }

  const token = process.env.HEALTH_CHECK_TOKEN;
  if (!token) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;

  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    if (!canReadDetailedHealth(request)) {
      return jsonSuccess(
        { status: "ok", timestamp: new Date().toISOString() },
        200,
        requestId,
      );
    }

    const { health } = createAdminServices();
    const result = await health.check();

    if (!result.ok) {
      return handleRouteError(result.error, requestId);
    }

    return jsonSuccess(result.value, 200, requestId);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
