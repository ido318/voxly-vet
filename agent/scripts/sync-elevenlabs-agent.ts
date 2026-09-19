/**
 * sync-elevenlabs-agent.ts
 *
 * Syncs the Tomer agent config to ElevenLabs Conversational AI.
 *   --dry-run   Show what would be sent; do NOT call the API.
 *
 * Authorization is a ConvAI Secret header (`{ secret_id }`), never a plaintext
 * Bearer Value. On a live run the workspace secret `tomer-tools-bearer` is
 * created/updated from TOOLS_BEARER_TOKEN so Fly and ElevenLabs stay aligned.
 *
 * Usage:
 *   cd agent
 *   node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-agent.ts [--dry-run]
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import {
  TOOLS_SECRET_NAME,
  applyResponseFilters,
  assertNoPlaintextToolSecrets,
  bearerSecretValue,
  buildBuiltInTools,
  parseWebhookTools,
  preserveUnmanagedSystemTools,
  substitutePublicUrl,
  substituteSecretId,
  type WebhookTool,
} from "../src/lib/elevenlabs-agent-sync.js";

const isDryRun = process.argv.includes("--dry-run");

// ── Env ───────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY  = process.env["ELEVENLABS_API_KEY"]  ?? "";
const ELEVENLABS_AGENT_ID = process.env["ELEVENLABS_AGENT_ID"] ?? "";
const AGENT_PUBLIC_URL =
  process.env["AGENT_PUBLIC_URL"] ?? process.env["PUBLIC_BASE_URL"] ?? "";
const TOOLS_BEARER_TOKEN = process.env["TOOLS_BEARER_TOKEN"] ?? "";
const ELEVENLABS_TOOLS_SECRET_ID = process.env["ELEVENLABS_TOOLS_SECRET_ID"] ?? "";
const HUMAN_HANDOFF_NUMBER = process.env["HUMAN_HANDOFF_NUMBER"] ?? "";

const missing: string[] = [];
if (!ELEVENLABS_API_KEY)  missing.push("ELEVENLABS_API_KEY");
if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");
if (!AGENT_PUBLIC_URL)    missing.push("AGENT_PUBLIC_URL or PUBLIC_BASE_URL");
if (!TOOLS_BEARER_TOKEN)  missing.push("TOOLS_BEARER_TOKEN");

if (missing.length > 0) {
  console.error(`[sync] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const EL_HEADERS = { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" };

async function elFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: { ...EL_HEADERS, ...(init?.headers ?? {}) },
  });
}

type StoredSecret = { secret_id: string; name: string };

async function listSecretsByName(name: string): Promise<StoredSecret[]> {
  const res = await elFetch(`/v1/convai/secrets?search=${encodeURIComponent(name)}`);
  if (!res.ok) {
    throw new Error(`list secrets failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json() as { secrets?: StoredSecret[] };
  return (body.secrets ?? []).filter((s) => s.name === name);
}

async function createToolsSecret(token: string): Promise<StoredSecret> {
  const res = await elFetch("/v1/convai/secrets", {
    method: "POST",
    body: JSON.stringify({
      type: "new",
      name: TOOLS_SECRET_NAME,
      value: bearerSecretValue(token),
    }),
  });
  if (!res.ok) {
    throw new Error(`create secret failed: ${res.status} ${await res.text()}`);
  }
  return await res.json() as StoredSecret;
}

async function updateToolsSecret(secretId: string, token: string): Promise<void> {
  const res = await elFetch(`/v1/convai/secrets/${secretId}`, {
    method: "PATCH",
    body: JSON.stringify({
      type: "update",
      name: TOOLS_SECRET_NAME,
      value: bearerSecretValue(token),
    }),
  });
  if (!res.ok) {
    throw new Error(`update secret failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Resolve the workspace secret id and, on a live run, write the current Fly
 * TOOLS_BEARER_TOKEN into it. One-sided rotation (Fly or ElevenLabs alone)
 * breaks every webhook tool.
 */
async function resolveToolsSecretId(): Promise<string> {
  if (isDryRun && ELEVENLABS_TOOLS_SECRET_ID) {
    return ELEVENLABS_TOOLS_SECRET_ID;
  }

  if (isDryRun) {
    try {
      if (ELEVENLABS_TOOLS_SECRET_ID) return ELEVENLABS_TOOLS_SECRET_ID;
      const existing = await listSecretsByName(TOOLS_SECRET_NAME);
      if (existing[0]) return existing[0].secret_id;
    } catch (err) {
      console.warn(`[sync] dry-run: could not list secrets (${err instanceof Error ? err.message : String(err)})`);
    }
    return "sec_dry_run";
  }

  if (ELEVENLABS_TOOLS_SECRET_ID) {
    await updateToolsSecret(ELEVENLABS_TOOLS_SECRET_ID, TOOLS_BEARER_TOKEN);
    return ELEVENLABS_TOOLS_SECRET_ID;
  }

  const existing = await listSecretsByName(TOOLS_SECRET_NAME);
  if (existing[0]) {
    await updateToolsSecret(existing[0].secret_id, TOOLS_BEARER_TOKEN);
    return existing[0].secret_id;
  }

  const created = await createToolsSecret(TOOLS_BEARER_TOKEN);
  console.log(`[sync] Created workspace secret ${TOOLS_SECRET_NAME} (${created.secret_id})`);
  return created.secret_id;
}

// ── Load knowledge files ──────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));

const systemPrompt = readFileSync(
  join(__dir, "../src/knowledge/tomer-system-prompt.md"),
  "utf-8",
).trim();

const toolsTemplate = readFileSync(
  join(__dir, "../src/knowledge/tomer-tools.json"),
  "utf-8",
);

const secretId = await resolveToolsSecretId();
const toolsJson = substituteSecretId(
  substitutePublicUrl(toolsTemplate, AGENT_PUBLIC_URL),
  secretId,
);
const tools: WebhookTool[] = applyResponseFilters(parseWebhookTools(toolsJson));
assertNoPlaintextToolSecrets(tools, TOOLS_BEARER_TOKEN);

if (!HUMAN_HANDOFF_NUMBER) {
  console.warn(
    "[sync] HUMAN_HANDOFF_NUMBER is unset — transfer_to_number will stay disabled; handoff will only escalate.",
  );
}

// ── Fetch current config (to preserve fields this script doesn't own) ─────────
const currentConfigRes = await elFetch(`/v1/convai/agents/${ELEVENLABS_AGENT_ID}`);
if (!currentConfigRes.ok) {
  console.error(`[sync] Failed to fetch current agent config: ${currentConfigRes.status}`);
  process.exit(1);
}
const currentConfig = await currentConfigRes.json() as {
  conversation_config?: {
    agent?: {
      prompt?: {
        knowledge_base?: unknown;
        rag?: unknown;
        tools?: Array<{ name?: string; type?: string }>;
      };
    };
  };
};
const existingKnowledgeBase = currentConfig.conversation_config?.agent?.prompt?.knowledge_base ?? [];
const existingRag = currentConfig.conversation_config?.agent?.prompt?.rag ?? { enabled: false };

const existingSystemTools = preserveUnmanagedSystemTools(
  currentConfig.conversation_config?.agent?.prompt?.tools ?? [],
);

const HEBREW_BACKCHANNEL_TERMS = [
  "אהה", "אה", "כן", "אוקיי", "או קיי", "אוקי",
  "נכון", "בסדר", "הבנתי", "ברור", "מממ", "אמממ", "יופי",
];

const builtInTools = buildBuiltInTools({
  handoffNumber: HUMAN_HANDOFF_NUMBER || null,
});

const patchPayload = {
  conversation_config: {
    agent: {
      first_message: "שלום, הגעתם למרפאת גט אה וֵט, מדבר תומר. איך אפשר לעזור?",
      language: "he",
      prompt: {
        prompt: systemPrompt,
        tools: [...tools, ...existingSystemTools],
        built_in_tools: builtInTools,
        knowledge_base: existingKnowledgeBase,
        rag: existingRag,
      },
    },
    turn: {
      turn_timeout: 4,
      turn_eagerness: "neutral",
      interruption_ignore_terms: HEBREW_BACKCHANNEL_TERMS,
      merge_with_default_ignore_terms: true,
      soft_timeout_config: {
        timeout_seconds: 3,
        message: "",
        use_llm_generated_message: false,
        randomize_fillers: false,
        max_soft_timeouts_per_generation: 1,
      },
    },
    vad: {
      background_voice_detection: true,
    },
    tts: {
      model_id: "eleven_v3_conversational",
      voice_id: "6u58Zr4cXPCkxTgRpkKk",
      speed: 1.08,
      stability: 0.4,
      optimize_streaming_latency: 3,
      text_normalisation_type: "system_prompt",
    },
  },
};

if (isDryRun) {
  console.log("=== DRY RUN — no changes will be sent to ElevenLabs ===\n");

  let currentPrompt = "(failed to fetch)";
  let currentToolNames: string[] = [];
  try {
    const data = currentConfig as {
      conversation_config?: {
        agent?: {
          prompt?: { prompt?: string; tools?: Array<{ name?: string }> };
        };
      };
    };
    currentPrompt = data.conversation_config?.agent?.prompt?.prompt ?? "(empty)";
    currentToolNames = (data.conversation_config?.agent?.prompt?.tools ?? [])
      .map((t) => t.name ?? "?");
  } catch (err) {
    currentPrompt = `(fetch error: ${err instanceof Error ? err.message : String(err)})`;
  }

  console.log(`Agent ID : ${ELEVENLABS_AGENT_ID}`);
  console.log(`Base URL : ${AGENT_PUBLIC_URL}`);
  console.log(`Auth     : Secret locator ${TOOLS_SECRET_NAME} (${secretId}) — not a Value header\n`);

  console.log("── SYSTEM PROMPT ─────────────────────────────────────────────");
  console.log(`Current : ${currentPrompt.length} chars`);
  console.log(`Proposed: ${systemPrompt.length} chars`);
  if (currentPrompt !== systemPrompt) {
    console.log("\n[CHANGED] First 400 chars of proposed prompt:");
    console.log(systemPrompt.slice(0, 400) + (systemPrompt.length > 400 ? "…" : ""));
  } else {
    console.log("[UNCHANGED]");
  }

  console.log("\n── TOOLS ─────────────────────────────────────────────────────");
  console.log(`Current  (${currentToolNames.length}): ${currentToolNames.join(", ") || "(none)"}`);
  const proposedTools = patchPayload.conversation_config.agent.prompt.tools;
  console.log(`Proposed (${proposedTools.length}):`);
  for (const t of proposedTools) {
    const webhook = t as WebhookTool;
    const apiUrl = webhook.api_schema?.url ?? "(system/other)";
    const reqBody = webhook.api_schema?.request_body_schema as { required?: string[] } | undefined;
    const auth = webhook.api_schema?.request_headers?.["Authorization"];
    const authLabel = typeof auth === "object" && auth
      ? `{ secret_id: ${auth.secret_id} }`
      : "(none)";
    console.log(`  • ${webhook.name ?? (t as { name?: string }).name}`);
    console.log(`    URL: ${apiUrl}`);
    console.log(`    Auth: ${authLabel}`);
    console.log(`    Required: ${JSON.stringify(reqBody?.required ?? [])}`);
  }

  console.log("\n── BUILT-IN SYSTEM TOOLS ─────────────────────────────────────");
  console.log(`transfer_to_number : ${HUMAN_HANDOFF_NUMBER ? "enabled → Dana mobile" : "disabled (HUMAN_HANDOFF_NUMBER unset)"}`);
  console.log("voicemail_detection: enabled with Hebrew message");
  console.log("language_detection : disabled");
  console.log("end_call           : custom description (no hangup while write tools pending)");

  console.log("\n── VOICE TURN SETTINGS ────────────────────────────────────────");
  console.log(`First message: ${patchPayload.conversation_config.agent.first_message}`);
  console.log(`Turn timeout : ${patchPayload.conversation_config.turn.turn_timeout}s`);
  console.log(`Turn eagerness: ${patchPayload.conversation_config.turn.turn_eagerness}`);
  console.log(`Soft timeout : ${patchPayload.conversation_config.turn.soft_timeout_config.timeout_seconds}s`);
  console.log(`TTS speed    : ${patchPayload.conversation_config.tts.speed}`);

  console.log("\n=== Run without --dry-run to apply ===");
  process.exit(0);
}

console.log(`[sync] Updating agent ${ELEVENLABS_AGENT_ID} …`);

const res = await elFetch(`/v1/convai/agents/${ELEVENLABS_AGENT_ID}`, {
  method: "PATCH",
  body: JSON.stringify(patchPayload),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`[sync] ElevenLabs API error ${res.status}: ${body}`);
  process.exit(1);
}

console.log(`[sync] Agent updated successfully.`);
console.log(`[sync] System prompt: ${systemPrompt.length} chars`);
console.log(`[sync] Tools synced: ${tools.map((t) => t.name).join(", ")}`);
console.log(`[sync] Authorization: Secret ${TOOLS_SECRET_NAME} (${secretId})`);
