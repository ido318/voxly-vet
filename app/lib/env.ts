import { z } from "zod";

const serverSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  HEALTH_CHECK_TOKEN: z.string().min(16).optional(),
  HEALTH_CHECK_ALLOWED_IPS: z.string().optional(),
  GREEN_INVOICE_API_KEY_ID: z.string().min(1).optional(),
  GREEN_INVOICE_API_KEY_SECRET: z.string().min(1).optional(),
  GREEN_INVOICE_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Vercel injects VERCEL_URL (host only, no scheme) into every deployment, and it
 * is the only value that names *this* deployment. APP_BASE_URL is a single fixed
 * value, so a preview that inherits Production's copy would call back into the
 * production API instead of its own; falling back to VERCEL_URL keeps each
 * deployment self-referential without a per-branch variable.
 *
 * An explicit APP_BASE_URL still wins, so local development and the fixed
 * production domain are unaffected.
 */
function resolveAppBaseUrl(): string | undefined {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  return undefined;
}

function parseEnv() {
  const client = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!client.success) {
    throw new Error(
      `Invalid public environment variables: ${client.error.message}`,
    );
  }

  const server = serverSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    APP_BASE_URL: resolveAppBaseUrl(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    HEALTH_CHECK_TOKEN: process.env.HEALTH_CHECK_TOKEN || undefined,
    HEALTH_CHECK_ALLOWED_IPS: process.env.HEALTH_CHECK_ALLOWED_IPS || undefined,
    GREEN_INVOICE_API_KEY_ID: process.env.GREEN_INVOICE_API_KEY_ID || undefined,
    GREEN_INVOICE_API_KEY_SECRET: process.env.GREEN_INVOICE_API_KEY_SECRET || undefined,
    GREEN_INVOICE_ENV: process.env.GREEN_INVOICE_ENV || undefined,
  });

  if (!server.success) {
    throw new Error(
      `Invalid server environment variables: ${server.error.message}`,
    );
  }

  return {
    ...client.data,
    ...server.data,
  };
}

export type Env = ReturnType<typeof parseEnv>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
