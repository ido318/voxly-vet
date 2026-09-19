import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

// Must match TOOLS_BEARER_TOKEN set in tests/setup.ts
function toolHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-tools-token-1234567",
  };
}
// Alias used throughout this file
const signedHeaders = () => toolHeaders();

import { toolsRoutes } from "../../../src/server/routes/tools.js";

// Mock the Supabase-backed store so tests don't touch the network
vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    findCustomerByPhone: vi.fn().mockResolvedValue(null),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { addEscalation } from "../../../src/lib/store.js";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

describe("POST /tools/escalate-to-vet", () => {
  it("returns confirmation with low urgency", async () => {
    const res = await makeApp().request("/tools/escalate-to-vet", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({
        reason: "לקוח מבקש שיחה עם דנה",
        urgency: 3,
        phone: "+972541234567",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("דנה");
    expect(json.result).toContain("3/10");
    expect(vi.mocked(addEscalation)).toHaveBeenCalledWith({
      reason: "לקוח מבקש שיחה עם דנה",
      urgency: 3,
      caller_phone: "+972541234567",
    });
  });

  // Was: "stores caller phone in notes until a dedicated column exists".
  // The column exists now (20260918230000), so the phone goes there. It used
  // to share `notes` with whatever a human typed when resolving the
  // escalation, which overwrote it.
  it("passes the caller phone through to its own column, not notes", async () => {
    const res = await makeApp().request("/tools/escalate-to-vet", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({
        reason: "חשבונית",
        urgency: 2,
        phone: "+972541234567",
      }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(addEscalation)).toHaveBeenCalledWith({
      reason: "חשבונית",
      urgency: 2,
      caller_phone: "+972541234567",
    });
    // notes stays free for the human resolving it.
    expect(vi.mocked(addEscalation).mock.calls[0]?.[0]).not.toHaveProperty("notes");
  });

  // The tool definition marks phone required so the model always sends
  // {{system__caller_id}}, but the server must not. A withheld caller id with
  // no number offered would otherwise drop the escalation entirely — and an
  // escalation Dana never sees is worse than one without a phone number.
  it("still records an escalation when the caller id is withheld", async () => {
    const res = await makeApp().request("/tools/escalate-to-vet", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({ reason: "חשבונית", urgency: 2 }),
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(addEscalation)).toHaveBeenCalledWith({
      reason: "חשבונית",
      urgency: 2,
      caller_phone: null,
    });
  });

  it("returns confirmation with high urgency (>=7)", async () => {
    const res = await makeApp().request("/tools/escalate-to-vet", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({ reason: "כלב מקיא דם", urgency: 9 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("9/10");
  });
});
