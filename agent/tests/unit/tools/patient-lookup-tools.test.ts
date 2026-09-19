import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

function toolHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer test-tools-token-1234567",
  };
}

vi.mock("../../../src/lib/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/store.js")>();
  return {
    ...actual,
    listCustomerPets: vi.fn(),
    getPatientReminders: vi.fn(),
    getPatientChronicConditions: vi.fn(),
    getLastVisitPlan: vi.fn(),
  };
});

import { toolsRoutes } from "../../../src/server/routes/tools.js";
import {
  getLastVisitPlan,
  getPatientChronicConditions,
  getPatientReminders,
  listCustomerPets,
} from "../../../src/lib/store.js";

const PHONE = "+972541234567";
const PET_ID = "11111111-1111-4111-8111-111111111111";

function makeApp() {
  const app = new Hono();
  app.route("/", toolsRoutes);
  return app;
}

describe("patient lookup tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCustomerPets).mockResolvedValue({
      result: `החיה הרשומה עבור דנה כהן היא מיקה (כלב), מזהה pet_id: ${PET_ID}.`,
      pets: [{ id: PET_ID, name: "מיקה", species: "כלב" }],
    });
    vi.mocked(getPatientReminders).mockResolvedValue("חיסונים קרובים עבור מיקה: חיסון כלבת (20/06/2026).");
    vi.mocked(getPatientChronicConditions).mockResolvedValue("אין רשומות של מצבים כרוניים עבור מיקה.");
    vi.mocked(getLastVisitPlan).mockResolvedValue("בביקור האחרון ד\"ר דנה קבעה את התוכנית הבאה עבור מיקה: המשך מעקב.");
  });

  it("POST /tools/list-customer-pets returns result and a structured pets array", async () => {
    const res = await makeApp().request("/tools/list-customer-pets", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string; pets: Array<{ id: string; name: string; species: string }> };
    expect(json.result).toContain("מיקה");
    expect(json.pets).toEqual([{ id: PET_ID, name: "מיקה", species: "כלב" }]);
    expect(vi.mocked(listCustomerPets)).toHaveBeenCalledWith(PHONE);
  });

  it("POST /tools/list-customer-pets rejects a missing phone with HTTP 200 and a Hebrew result", async () => {
    const res = await makeApp().request("/tools/list-customer-pets", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("phone");
    expect(vi.mocked(listCustomerPets)).not.toHaveBeenCalled();
  });

  it("POST /tools/list-customer-pets returns a generic 500 on internal error", async () => {
    vi.mocked(listCustomerPets).mockRejectedValue(new Error("boom"));
    const res = await makeApp().request("/tools/list-customer-pets", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE }),
    });

    expect(res.status).toBe(500);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("שגיאה פנימית");
  });

  it("POST /tools/get-patient-reminders forwards phone + pet_id and returns the result string", async () => {
    const res = await makeApp().request("/tools/get-patient-reminders", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("חיסון כלבת");
    expect(vi.mocked(getPatientReminders)).toHaveBeenCalledWith(PHONE, PET_ID);
  });

  it("POST /tools/get-patient-reminders rejects a missing pet_id with HTTP 200 and a Hebrew result", async () => {
    const res = await makeApp().request("/tools/get-patient-reminders", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("pet_id");
    expect(vi.mocked(getPatientReminders)).not.toHaveBeenCalled();
  });

  it("POST /tools/get-patient-reminders returns a generic 500 on internal error", async () => {
    vi.mocked(getPatientReminders).mockRejectedValue(new Error("boom"));
    const res = await makeApp().request("/tools/get-patient-reminders", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
    });

    expect(res.status).toBe(500);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("שגיאה פנימית");
  });

  it("POST /tools/get-patient-chronic-conditions forwards phone + pet_id", async () => {
    const res = await makeApp().request("/tools/get-patient-chronic-conditions", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("מצבים כרוניים");
    expect(vi.mocked(getPatientChronicConditions)).toHaveBeenCalledWith(PHONE, PET_ID);
  });

  it("POST /tools/get-patient-chronic-conditions rejects a missing phone with HTTP 200 and a Hebrew result", async () => {
    const res = await makeApp().request("/tools/get-patient-chronic-conditions", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ pet_id: PET_ID }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("phone");
    expect(vi.mocked(getPatientChronicConditions)).not.toHaveBeenCalled();
  });

  it("POST /tools/get-last-visit-plan forwards phone + pet_id", async () => {
    const res = await makeApp().request("/tools/get-last-visit-plan", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("התוכנית הבאה");
    expect(vi.mocked(getLastVisitPlan)).toHaveBeenCalledWith(PHONE, PET_ID);
  });

  it("POST /tools/get-last-visit-plan rejects a missing pet_id with HTTP 200 and a Hebrew result", async () => {
    const res = await makeApp().request("/tools/get-last-visit-plan", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("pet_id");
    expect(vi.mocked(getLastVisitPlan)).not.toHaveBeenCalled();
  });

  it("POST /tools/get-last-visit-plan returns a generic 500 on internal error", async () => {
    vi.mocked(getLastVisitPlan).mockRejectedValue(new Error("boom"));
    const res = await makeApp().request("/tools/get-last-visit-plan", {
      method: "POST",
      headers: toolHeaders(),
      body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
    });

    expect(res.status).toBe(500);
    const json = (await res.json()) as { result: string };
    expect(json.result).toContain("שגיאה פנימית");
  });

  it("rejects all four new routes without a valid bearer token", async () => {
    const badHeaders = { "Content-Type": "application/json", "Authorization": "Bearer wrong-token" };
    const routes = [
      "/tools/list-customer-pets",
      "/tools/get-patient-reminders",
      "/tools/get-patient-chronic-conditions",
      "/tools/get-last-visit-plan",
    ];

    for (const path of routes) {
      const res = await makeApp().request(path, {
        method: "POST",
        headers: badHeaders,
        body: JSON.stringify({ phone: PHONE, pet_id: PET_ID }),
      });
      expect(res.status).toBe(403);
    }

    expect(vi.mocked(listCustomerPets)).not.toHaveBeenCalled();
    expect(vi.mocked(getPatientReminders)).not.toHaveBeenCalled();
    expect(vi.mocked(getPatientChronicConditions)).not.toHaveBeenCalled();
    expect(vi.mocked(getLastVisitPlan)).not.toHaveBeenCalled();
  });
});
