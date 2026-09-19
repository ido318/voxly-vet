export const ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * Calls Claude with a system prompt and a JSON-serializable user payload,
 * requesting JSON-only output, and returns the parsed JSON. Throws on HTTP
 * failure, missing text content, or invalid JSON — callers validate the
 * parsed shape themselves since it differs per caller.
 */
export async function callClaudeForJson(
  apiKey: string,
  systemPrompt: string,
  userContent: unknown,
): Promise<unknown> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(userContent),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic API returned no text content");

  try {
    return JSON.parse(stripMarkdownJsonFence(text));
  } catch {
    throw new Error(`Anthropic API returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

/** Claude sometimes wraps requested-JSON-only output in a ```json fence despite instructions. */
function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
