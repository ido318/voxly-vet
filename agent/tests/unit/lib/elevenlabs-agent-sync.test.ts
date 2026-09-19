import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { VISIT_TYPE_VALUES } from "../../../src/lib/appointments.js";
import {
  END_CALL_DESCRIPTION,
  EXTRA_RESPONSE_FIELDS,
  TOOLS_SECRET_NAME,
  VOICEMAIL_MESSAGE_HE,
  applyResponseFilters,
  assertNoPlaintextToolSecrets,
  authorizationUsesSecretLocator,
  bearerSecretValue,
  buildBuiltInTools,
  parseWebhookTools,
  preserveUnmanagedSystemTools,
  substitutePublicUrl,
  substituteSecretId,
} from "../../../src/lib/elevenlabs-agent-sync.js";

const toolsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/knowledge/tomer-tools.json",
);

function loadTools() {
  const template = readFileSync(toolsPath, "utf-8");
  const json = substituteSecretId(
    substitutePublicUrl(template, "https://your-agent.fly.dev"),
    "sec_test_abc",
  );
  return applyResponseFilters(parseWebhookTools(json));
}

describe("elevenlabs agent sync helpers", () => {
  it("writes Authorization as a ConvAISecretLocator, never a Bearer Value", () => {
    const tools = loadTools();
    expect(authorizationUsesSecretLocator(tools)).toBe(true);
    expect(() => assertNoPlaintextToolSecrets(tools, "super-secret-token-999")).not.toThrow();
    expect(JSON.stringify(tools)).not.toContain("Bearer ");
    expect(JSON.stringify(tools)).not.toContain("{{AGENT_TOOLS_BEARER_TOKEN}}");
    expect(JSON.stringify(tools)).not.toContain("super-secret-token-999");
    expect(bearerSecretValue("abc")).toBe("Bearer abc");
    expect(TOOLS_SECRET_NAME).toBe("tomer-tools-bearer");
  });

  it("rejects a payload that still inlines the bearer token as a Value header", () => {
    const tools = loadTools();
    const leaked = structuredClone(tools);
    leaked[0]!.api_schema.request_headers = {
      Authorization: "Bearer super-secret-token-999",
    };
    expect(() => assertNoPlaintextToolSecrets(leaked, "super-secret-token-999")).toThrow(
      /plaintext Value|Bearer Value/,
    );
  });

  it("keeps visit_type and action enums closed to match the server", () => {
    const tools = loadTools();
    const visitTypeTools = tools.filter((tool) => {
      const props = (tool.api_schema.request_body_schema as {
        properties?: Record<string, { enum?: string[] }>;
      } | undefined)?.properties;
      return Boolean(props?.["visit_type"]);
    });
    expect(visitTypeTools.length).toBeGreaterThan(0);
    for (const tool of visitTypeTools) {
      const visitType = (tool.api_schema.request_body_schema as {
        properties: { visit_type: { enum: string[] } };
      }).properties.visit_type;
      expect(visitType.enum).toEqual([...VISIT_TYPE_VALUES]);
    }

    const cancel = tools.find((t) => t.name === "cancel-or-reschedule");
    const action = (cancel?.api_schema.request_body_schema as {
      properties: { action: { enum: string[] } };
    }).properties.action;
    expect(action.enum).toEqual(["cancel", "reschedule"]);
  });

  it("includes list-customer-appointments and filters extra response fields", () => {
    const tools = loadTools();
    expect(tools.map((t) => t.name)).toContain("list-customer-appointments");

    const lookup = tools.find((t) => t.name === "lookup-customer");
    expect(lookup?.response_filters).toEqual(EXTRA_RESPONSE_FIELDS["lookup-customer"]);
    expect(lookup?.response_filter_mode).toBe("allow");

    const book = tools.find((t) => t.name === "book-appointment");
    expect(book?.response_filters).toEqual(["result"]);

    const handoff = tools.find((t) => t.name === "request-human-handoff");
    expect(handoff?.response_filters).toEqual(EXTRA_RESPONSE_FIELDS["request-human-handoff"]);
  });

  it("enables transfer_to_number, voicemail copy, and disables language detection", () => {
    const enabled = buildBuiltInTools({ handoffNumber: "+972501234567" });
    expect(enabled["language_detection"]).toBeNull();
    expect(enabled["transfer_to_agent"]).toBeNull();
    expect(enabled["skip_turn"]).toBeNull();
    expect(enabled["play_keypad_touch_tone"]).toBeNull();

    const transfer = enabled["transfer_to_number"] as {
      params: { transfers: Array<{ transfer_destination: { phone_number: string } }> };
    };
    expect(transfer.params.transfers[0]?.transfer_destination.phone_number).toBe("+972501234567");

    const voicemail = enabled["voicemail_detection"] as {
      params: { voicemail_message: string };
    };
    expect(voicemail.params.voicemail_message).toBe(VOICEMAIL_MESSAGE_HE);
    expect(VOICEMAIL_MESSAGE_HE.length).toBeGreaterThan(10);

    const endCall = enabled["end_call"] as { description: string };
    expect(endCall.description).toBe(END_CALL_DESCRIPTION);

    const disabled = buildBuiltInTools({ handoffNumber: null });
    expect(disabled["transfer_to_number"]).toBeNull();
  });

  it("does not blindly preserve a disabled transfer_to_number system tool", () => {
    const preserved = preserveUnmanagedSystemTools([
      { type: "system", name: "transfer_to_number" },
      { type: "system", name: "language_detection" },
      { type: "system", name: "end_call" },
      { type: "system", name: "some_future_system_tool" },
      { type: "webhook", name: "lookup-customer" },
    ]);
    expect(preserved).toEqual([{ type: "system", name: "some_future_system_tool" }]);
  });
});
