import { Hono, type Context } from "hono";
import { getEnv } from "../../lib/env.js";
import { processNotifications } from "../../services/notification.processor.js";
import { analyzeConversations } from "../../lib/learning/analyzeConversations.js";
import { logger } from "../../lib/logger.js";
import { isValidBearerToken } from "../middleware/bearerAuth.js";

const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const idempotencyCache = new Map<string, { expiresAt: number; response: unknown }>();
const rateLimitCache = new Map<string, number[]>();

export function resetJobSecurityCaches(): void {
  idempotencyCache.clear();
  rateLimitCache.clear();
}

function getRateLimitClient(c: { req: { header: (name: string) => string | undefined } }): string {
  const forwarded = c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  return "unknown";
}

function enforceRateLimit(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const key = getRateLimitClient(c);
  const now = Date.now();
  const timestamps = rateLimitCache.get(key) ?? [];
  const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitCache.set(key, recent);
    logger.warn({ caller: key, recentCount: recent.length }, "jobs: rate limit exceeded");
    return false;
  }

  recent.push(now);
  rateLimitCache.set(key, recent);
  return true;
}

function getCachedResponse(key: string | undefined): unknown | undefined {
  if (!key) return undefined;
  const entry = idempotencyCache.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    idempotencyCache.delete(key);
    return undefined;
  }

  return entry.response;
}

function cacheResponse(key: string | undefined, response: unknown): void {
  if (!key) return;
  idempotencyCache.set(key, {
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    response,
  });
}

function getIdempotencyCacheKey(route: string, key: string | undefined): string | undefined {
  if (!key) return undefined;
  return `${route}:${key}`;
}

function parseJobBody(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Pinned to this agent. JOBS_BEARER_TOKEN is one secret — never take clinicId from the body. */
export function pinnedJobClinicId(): string {
  return getEnv().AGENT_CLINIC_ID;
}

/** Bearer auth + in-memory idempotency + per-caller rate limit for job routes. */
export async function runProtectedJob(
  c: Context,
  routeName: string,
  run: () => Promise<unknown>,
): Promise<Response> {
  if (!isValidBearerToken(c.req.header("Authorization"), getEnv().JOBS_BEARER_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const idempotencyKey = c.req.header("Idempotency-Key") ?? c.req.header("idempotency-key");
  const cacheKey = getIdempotencyCacheKey(routeName, idempotencyKey);
  const cached = getCachedResponse(cacheKey);
  if (cached !== undefined) {
    return c.json(cached);
  }

  if (!enforceRateLimit(c)) {
    return c.json({ error: "rate_limited" }, 429);
  }

  try {
    const result = await run();
    logger.info(result, `${routeName} complete`);
    cacheResponse(cacheKey, result);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, `${routeName} failed`);
    return c.json({ error: message }, 500);
  }
}

export const jobsRoutes = new Hono();

jobsRoutes.post("/process-notifications", async (c) => {
  return runProtectedJob(c, "process-notifications", async () => {
    const body = parseJobBody(await c.req.json().catch(() => ({})));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : undefined;
    return processNotifications({ appointmentId, clinicId: pinnedJobClinicId() });
  });
});

jobsRoutes.post("/analyze-conversations", async (c) => {
  return runProtectedJob(c, "analyze-conversations", async () => {
    return analyzeConversations(pinnedJobClinicId());
  });
});
