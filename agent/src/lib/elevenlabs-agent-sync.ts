/**
 * Pure helpers for sync-elevenlabs-agent.ts.
 *
 * Authorization headers use ElevenLabs ConvAISecretLocator
 * `{ secret_id }` (UI type Secret), never a plaintext Bearer Value.
 * @see https://elevenlabs.io/docs/eleven-agents/api-reference/tools/create
 * @see https://elevenlabs.io/docs/api-reference/workspace/secrets/create
 */

export const TOOLS_SECRET_NAME = "tomer-tools-bearer";

export const VOICEMAIL_MESSAGE_HE =
  "שלום, זו הודעה מתומר במרפאת גט אה וט. נשמח אם תחזרו אלינו בהקדם.";

export const END_CALL_DESCRIPTION =
  "סיים את השיחה רק אחרי פרידה ברורה מהלקוח. אסור לקרוא ל-end_call בזמן המתנה לתוצאת כלי כותב (book-appointment, cancel-or-reschedule, join-waitlist, request-human-handoff).";

/** System tools this sync owns. Others on the live agent are preserved. */
export const MANAGED_SYSTEM_TOOL_NAMES = new Set([
  "end_call",
  "language_detection",
  "play_keypad_touch_tone",
  "skip_turn",
  "transfer_to_agent",
  "transfer_to_number",
  "voicemail_detection",
]);

/** Tools whose JSON includes fields the model must see besides `result`. */
export const EXTRA_RESPONSE_FIELDS: Record<string, string[]> = {
  "lookup-customer": ["result", "customer_id", "pets"],
  "list-customer-pets": ["result", "pets"],
  "list-customer-appointments": ["result", "appointments"],
  "request-human-handoff": ["result", "transfer", "number"],
};

export type SecretLocatorHeader = { secret_id: string };

export type WebhookTool = {
  type: "webhook";
  name: string;
  description: string;
  api_schema: {
    url: string;
    method: string;
    request_headers?: Record<string, string | SecretLocatorHeader>;
    request_body_schema?: Record<string, unknown>;
  };
  response_filter_mode?: "all" | "allow" | "hide_all";
  response_filters?: string[];
};

export type ExistingPromptTool = { name?: string; type?: string };

export function substitutePublicUrl(template: string, publicUrl: string): string {
  return template.replaceAll("{{AGENT_PUBLIC_URL}}", publicUrl.replace(/\/$/, ""));
}

export function substituteSecretId(template: string, secretId: string): string {
  return template.replaceAll("{{ELEVENLABS_TOOLS_SECRET_ID}}", secretId);
}

export function parseWebhookTools(json: string): WebhookTool[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("tomer-tools.json must be a JSON array");
  }
  return parsed as WebhookTool[];
}

export function applyResponseFilters(tools: WebhookTool[]): WebhookTool[] {
  return tools.map((tool) => {
    const fields = EXTRA_RESPONSE_FIELDS[tool.name] ?? ["result"];
    return {
      ...tool,
      response_filter_mode: "allow",
      response_filters: fields,
    };
  });
}

export function assertNoPlaintextToolSecrets(tools: WebhookTool[], bearerToken: string): void {
  const json = JSON.stringify(tools);
  if (bearerToken.length > 0 && json.includes(bearerToken)) {
    throw new Error("sync payload must not contain TOOLS_BEARER_TOKEN as a plaintext Value");
  }
  if (json.includes("{{AGENT_TOOLS_BEARER_TOKEN}}") || json.includes("Bearer ")) {
    throw new Error("sync payload must not write Authorization as a Bearer Value string");
  }

  for (const tool of tools) {
    const auth = tool.api_schema.request_headers?.["Authorization"];
    if (typeof auth === "string") {
      throw new Error(`${tool.name}: Authorization must be a ConvAISecretLocator, not a string Value`);
    }
    if (!auth || typeof auth.secret_id !== "string" || auth.secret_id.length === 0) {
      throw new Error(`${tool.name}: Authorization must be { secret_id }`);
    }
  }
}

export function authorizationUsesSecretLocator(tools: WebhookTool[]): boolean {
  return tools.every((tool) => {
    const auth = tool.api_schema.request_headers?.["Authorization"];
    return typeof auth === "object" && auth !== null && typeof auth.secret_id === "string";
  });
}

export function preserveUnmanagedSystemTools(
  existing: ExistingPromptTool[],
): ExistingPromptTool[] {
  return existing.filter(
    (tool) =>
      tool.type !== "webhook" &&
      typeof tool.name === "string" &&
      !MANAGED_SYSTEM_TOOL_NAMES.has(tool.name),
  );
}

export function bearerSecretValue(token: string): string {
  return `Bearer ${token}`;
}

export function buildBuiltInTools(params: { handoffNumber?: string | null }): Record<string, unknown> {
  const transferToNumber = params.handoffNumber
    ? {
        type: "system",
        name: "transfer_to_number",
        description:
          'העבר את השיחה החיה לנייד של ד"ר דנה. קרא לכלי הזה רק אחרי ש-request-human-handoff החזיר transfer=true, עם אותו number.',
        params: {
          system_tool_type: "transfer_to_number",
          transfers: [
            {
              transfer_destination: {
                type: "phone",
                phone_number: params.handoffNumber,
              },
              condition:
                "request-human-handoff החזיר transfer=true והמספר שחזר תואם ליעד ההעברה.",
              transfer_type: "conference",
            },
          ],
        },
      }
    : null;

  return {
    transfer_to_number: transferToNumber,
    voicemail_detection: {
      type: "system",
      name: "voicemail_detection",
      params: {
        system_tool_type: "voicemail_detection",
        voicemail_message: VOICEMAIL_MESSAGE_HE,
      },
    },
    language_detection: null,
    transfer_to_agent: null,
    skip_turn: null,
    play_keypad_touch_tone: null,
    end_call: {
      type: "system",
      name: "end_call",
      description: END_CALL_DESCRIPTION,
      params: { system_tool_type: "end_call" },
    },
  };
}
