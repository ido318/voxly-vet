import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PUBLIC_BASE_URL: z.string().url(),

  TWILIO_ACCOUNT_SID: z.string().startsWith("AC"),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().startsWith("+"),
  TWILIO_VALIDATE_SIGNATURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_AGENT_ID: z.string().min(1),
  ELEVENLABS_WEBHOOK_SECRET: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Clinic routing — which clinic record the agent writes to in the unified schema
  AGENT_CLINIC_ID: z.string().uuid(),

  // Human handoff — Dana's mobile (E.164). When set, Tomer transfers live calls
  // here during business hours; otherwise it records an escalation instead.
  HUMAN_HANDOFF_NUMBER: z.string().startsWith("+").optional(),

  // Bearer token securing POST /jobs/process-notifications (called by pg_cron)
  JOBS_BEARER_TOKEN: z.string().min(16),

  // Bearer token securing ElevenLabs POST /tools/* calls
  TOOLS_BEARER_TOKEN: z.string().min(16),

  // Prompt learning loop (optional — must never block Tomer's boot if unset).
  // Used only by POST /jobs/analyze-conversations.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[agent] Invalid environment variables:\n${issues}`);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
