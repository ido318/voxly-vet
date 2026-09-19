import { describe, it, expect, vi, beforeEach } from "vitest";
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
    findCustomerByPhone: vi.fn(),
    addEscalation: vi.fn().mockResolvedValue(undefined),
  };
});

import { findCustomerByPhone, normalisePhone } from "../../../src/lib/store.js";

const mockCustomer = {
  id: "11111111-1111-4111-8111-111111111111",
  phone: "+972541234567",
  full_name: "עידו אמסלם",
  pets: [{ id: "22222222-2222-4222-8222-222222222222", name: "בורבי", species: "כלב", breed: "פודל" }],
  notes: "אלרגיה לעוף ידועה",
};

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

describe("POST /tools/lookup-customer", () => {
  beforeEach(() => {
    vi.mocked(findCustomerByPhone).mockImplementation(async (phone: string) =>
      normalisePhone(phone) === mockCustomer.phone ? mockCustomer : null,
    );
  });

  it("returns customer data for a known phone (E.164)", async () => {
    const res = await makeApp().request("/tools/lookup-customer", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({ phone: "+972541234567" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      result: string;
      customer_id: string;
      pets: Array<{ id: string; name: string; species: string }>;
    };
    expect(json.result).toContain("עידו אמסלם");
    expect(json.result).toContain("בורבי");
    expect(json.customer_id).toBe(mockCustomer.id);
    expect(json.pets).toEqual([{ id: mockCustomer.pets[0]!.id, name: "בורבי", species: "כלב" }]);
  });

  it("normalises 05x prefix to E.164 and finds customer", async () => {
    const res = await makeApp().request("/tools/lookup-customer", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({ phone: "0541234567" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("עידו אמסלם");
  });

  it("returns unknown customer message for an unrecognised phone", async () => {
    const res = await makeApp().request("/tools/lookup-customer", {
      method: "POST",
      headers: signedHeaders(),
      body: JSON.stringify({ phone: "+972599999999" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { result: string };
    expect(json.result).toContain("לא מוכר");
  });
});
