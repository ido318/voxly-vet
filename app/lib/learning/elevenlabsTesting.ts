import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { RegressionOutcome } from "@/types/domain/prompt-suggestion";

function getConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  const testIds =
    process.env.ELEVENLABS_TEST_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
  if (!agentId) throw new Error("ELEVENLABS_AGENT_ID is not configured");
  if (testIds.length === 0) throw new Error("ELEVENLABS_TEST_IDS is not configured");

  return { apiKey, agentId, testIds };
}

let _client: ElevenLabsClient | null = null;
function getClient(apiKey: string): ElevenLabsClient {
  if (!_client) _client = new ElevenLabsClient({ apiKey });
  return _client;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // ~2 minutes total

/**
 * Runs the configured regression tests against a CANDIDATE prompt (via
 * agentConfigOverride) without publishing it, then polls the invocation
 * until every test run leaves "pending". `allPassed` is explicitly `null` —
 * never `false` — when a confident passed/failed verdict can't be reached
 * (unrecognized status, or still pending after MAX_POLL_ATTEMPTS), so the
 * caller knows not to trust a false negative/positive.
 *
 * Goes through the SDK (not a raw fetch) because ElevenLabs' request/response
 * bodies are snake_case while the SDK deserializes to camelCase — mixing a
 * camelCase object (e.g. platformSettings straight off agents.get()) into a
 * hand-built snake_case fetch body silently drops nested fields.
 *
 * See docs: elevenlabs.io/docs/eleven-agents/api-reference/tests/run-tests
 */
export async function runRegressionTests(candidatePrompt: string): Promise<RegressionOutcome> {
  const { apiKey, agentId, testIds } = getConfig();
  const client = getClient(apiKey);

  // agentConfigOverride requires platformSettings even though we're only
  // overriding the prompt — ElevenLabs rejects the request without it.
  // Carry the agent's current platform settings forward unchanged.
  const current = await client.conversationalAi.agents.get(agentId);

  if (!current.platformSettings) {
    throw new Error("ElevenLabs agent returned no platform settings");
  }

  const invocation = await client.conversationalAi.agents.runTests(agentId, {
    tests: testIds.map((testId) => ({ testId })),
    agentConfigOverride: {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: candidatePrompt,
          },
        },
      },
      platformSettings: current.platformSettings,
    },
  });

  const resolved = await pollUntilResolved(client, invocation.id);
  return { allPassed: detectAllPassed(resolved.testRuns), raw: resolved as unknown as Record<string, unknown> };
}

async function pollUntilResolved(
  client: ElevenLabsClient,
  invocationId: string,
): Promise<{ testRuns: Array<{ status: string }> }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const invocation = await client.conversationalAi.tests.invocations.get(invocationId);
    const testRuns = invocation.testRuns ?? [];
    if (testRuns.length > 0 && testRuns.every((run) => run.status !== "pending")) {
      return { testRuns };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`ElevenLabs test invocation ${invocationId} did not resolve within the poll window`);
}

/**
 * Deliberately conservative: only true/false when every test run resolved to
 * exactly "passed" or "failed". Anything else (unrecognized status, empty
 * list) -> null, which the caller treats as "do not publish".
 */
function detectAllPassed(testRuns: Array<{ status: string }>): boolean | null {
  if (testRuns.length === 0) return null;
  if (testRuns.some((run) => run.status !== "passed" && run.status !== "failed")) return null;
  return testRuns.every((run) => run.status === "passed");
}

/** Fetches the agent's current live conversationConfig, for `previous_prompt` snapshotting. */
export async function getLiveAgentConfig(): Promise<Record<string, unknown>> {
  const { apiKey, agentId } = getConfig();
  const agent = await getClient(apiKey).conversationalAi.agents.get(agentId);
  return agent.conversationConfig as unknown as Record<string, unknown>;
}

/**
 * Publishes a new system prompt to the live agent. Fetches the current
 * config first and carries tools/knowledge_base/rag forward unchanged —
 * ElevenLabs' merge semantics for nested conversation_config.agent.prompt
 * are undocumented, so a bare `{ prompt: newPromptText }` PATCH risks
 * silently wiping the agent's tools and knowledge base (same class of bug
 * fixed in agent/scripts/sync-elevenlabs-agent.ts during the KB rollout).
 */
export async function publishPrompt(newPromptText: string): Promise<Record<string, unknown>> {
  const { apiKey, agentId } = getConfig();
  const client = getClient(apiKey);

  const current = await client.conversationalAi.agents.get(agentId);
  const currentPrompt = current.conversationConfig.agent?.prompt;

  const updated = await client.conversationalAi.agents.update(agentId, {
    conversationConfig: {
      agent: {
        prompt: {
          prompt: newPromptText,
          tools: currentPrompt?.tools,
          knowledgeBase: currentPrompt?.knowledgeBase,
          rag: currentPrompt?.rag,
        },
      },
    },
  });
  return updated as unknown as Record<string, unknown>;
}
