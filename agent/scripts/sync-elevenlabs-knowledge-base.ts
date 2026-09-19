/**
 * sync-elevenlabs-knowledge-base.ts
 *
 * Syncs the 4 Tomer KB markdown docs (agent/src/knowledge/kb/*.md) to
 * ElevenLabs' Knowledge Base and points the agent's conversation_config at
 * them with usage_mode "prompt" (deterministic injection, no RAG retrieval).
 *
 * ElevenLabs has no in-place KB document update: editing = create-new +
 * re-point the agent + delete-old. This script does all three in order,
 * only deleting old docs after the agent re-point succeeds.
 *
 *   --dry-run   Show what would change; do NOT call create/patch/delete.
 *
 * Usage:
 *   cd agent
 *   node --env-file=.env --import tsx/esm scripts/sync-elevenlabs-knowledge-base.ts [--dry-run]
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname, basename, extname } from "path";

const isDryRun = process.argv.includes("--dry-run");

// ── Env ───────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY  = process.env["ELEVENLABS_API_KEY"]  ?? "";
const ELEVENLABS_AGENT_ID = process.env["ELEVENLABS_AGENT_ID"] ?? "";

const missing: string[] = [];
if (!ELEVENLABS_API_KEY)  missing.push("ELEVENLABS_API_KEY");
if (!ELEVENLABS_AGENT_ID) missing.push("ELEVENLABS_AGENT_ID");

if (missing.length > 0) {
  console.error(`[sync-kb] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Load KB source files ────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const kbDir = join(__dir, "../src/knowledge/kb");

const kbFiles = readdirSync(kbDir)
  .filter((f) => extname(f) === ".md")
  .sort();

if (kbFiles.length === 0) {
  console.error(`[sync-kb] No .md files found in ${kbDir}`);
  process.exit(1);
}

type KbSource = { docName: string; content: string };

const kbSources: KbSource[] = kbFiles.map((file) => ({
  docName: `tomer-kb-${basename(file, ".md")}`,
  content: readFileSync(join(kbDir, file), "utf-8").trim(),
}));

// ── Fetch current agent config (preserve prompt/tools; find old KB doc ids) ──

type AgentPromptConfig = {
  prompt?: string;
  tools?: unknown;
  knowledge_base?: Array<{ type: string; name: string; id: string; usage_mode?: string }>;
  rag?: Record<string, unknown>;
};

async function fetchAgentPrompt(): Promise<AgentPromptConfig> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
    { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch agent config: ${res.status}`);
  }
  const data = await res.json() as {
    conversation_config?: { agent?: { prompt?: AgentPromptConfig } };
  };
  return data.conversation_config?.agent?.prompt ?? {};
}

const currentPrompt = await fetchAgentPrompt();
const existingKnowledgeBase = currentPrompt.knowledge_base ?? [];

// Old docs to delete: any existing knowledge_base entry whose name matches
// one of our docNames (i.e. a previous version of the same doc we're about
// to replace). Entries with unrelated names are left untouched.
const ourDocNames = new Set(kbSources.map((s) => s.docName));
const oldDocsToDelete = existingKnowledgeBase.filter((doc) => ourDocNames.has(doc.name));

// ── Dry-run ───────────────────────────────────────────────────────────────────

if (isDryRun) {
  console.log("=== DRY RUN — no changes will be sent to ElevenLabs ===\n");
  console.log(`Agent ID: ${ELEVENLABS_AGENT_ID}\n`);

  console.log("── KB DOCUMENTS TO CREATE ──────────────────────────────────────");
  for (const src of kbSources) {
    console.log(`  • ${src.docName} (${src.content.length} chars)`);
  }

  console.log("\n── EXISTING KB DOCS ON AGENT ───────────────────────────────────");
  if (existingKnowledgeBase.length === 0) {
    console.log("  (none)");
  } else {
    for (const doc of existingKnowledgeBase) {
      const willDelete = ourDocNames.has(doc.name) ? " [WILL BE REPLACED]" : "";
      console.log(`  • ${doc.name} (id: ${doc.id})${willDelete}`);
    }
  }

  console.log("\n── RAG CONFIG ───────────────────────────────────────────────────");
  console.log(`Current: ${JSON.stringify(currentPrompt.rag ?? {})}`);
  console.log(`Proposed: {"enabled":false}`);

  console.log("\n=== Run without --dry-run to apply ===");
  process.exit(0);
}

// ── Live push ─────────────────────────────────────────────────────────────────

console.log(`[sync-kb] Creating ${kbSources.length} KB documents…`);

const createdDocs: Array<{ type: "text"; name: string; id: string; usage_mode: "prompt" }> = [];

for (const src of kbSources) {
  const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: src.content, name: src.docName }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[sync-kb] Failed to create doc "${src.docName}": ${res.status} ${body}`);
    if (createdDocs.length > 0) {
      console.error(
        `[sync-kb] ${createdDocs.length} doc(s) created before this failure were never attached ` +
        `to the agent, so a re-run will NOT find or replace them (this script only matches ` +
        `against the agent's currently-attached knowledge_base). Delete them manually via ` +
        `DELETE /v1/convai/knowledge-base/{id}?force=true: ` +
        `${createdDocs.map((d) => `${d.name} (${d.id})`).join(", ")}`,
      );
    }
    process.exit(1);
  }

  const created = await res.json() as { id: string; name: string };
  createdDocs.push({ type: "text", name: created.name, id: created.id, usage_mode: "prompt" });
  console.log(`[sync-kb]   created ${created.name} (id: ${created.id})`);
}

console.log(`[sync-kb] Re-pointing agent to new KB documents…`);

const patchRes = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`,
  {
    method: "PATCH",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            prompt: currentPrompt.prompt,
            tools: currentPrompt.tools,
            knowledge_base: createdDocs,
            // Preserve any other rag fields (embedding_model, max_vector_distance, …)
            // the account already has — only override `enabled`, same
            // fetch-then-merge defensiveness as sync-elevenlabs-agent.ts.
            rag: { ...currentPrompt.rag, enabled: false },
          },
        },
      },
    }),
  },
);

if (!patchRes.ok) {
  const body = await patchRes.text();
  console.error(`[sync-kb] Failed to update agent: ${patchRes.status} ${body}`);
  console.error(`[sync-kb] New docs were created but NOT attached. Created ids: ${createdDocs.map((d) => d.id).join(", ")}`);
  console.error(`[sync-kb] Not deleting old docs since the agent still points at them.`);
  process.exit(1);
}

console.log(`[sync-kb] Agent updated. Deleting ${oldDocsToDelete.length} superseded document(s)…`);

for (const oldDoc of oldDocsToDelete) {
  const delRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/knowledge-base/${oldDoc.id}?force=true`,
    { method: "DELETE", headers: { "xi-api-key": ELEVENLABS_API_KEY } },
  );
  if (!delRes.ok) {
    const body = await delRes.text();
    console.error(`[sync-kb]   WARNING: failed to delete superseded doc ${oldDoc.name} (${oldDoc.id}): ${delRes.status} ${body}`);
  } else {
    console.log(`[sync-kb]   deleted ${oldDoc.name} (${oldDoc.id})`);
  }
}

console.log(`[sync-kb] Done. ${createdDocs.length} documents live, usage_mode=prompt, rag.enabled=false.`);
