import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { jobsRoutes, resetJobSecurityCaches } from "../../../src/server/routes/jobs.js";

vi.mock("../../../src/services/notification.processor.js", () => ({
  processNotifications: vi.fn().mockResolvedValue({
    processed: 1,
    sent: 1,
    failed: 0,
    deferred: 0,
  }),
}));

vi.mock("../../../src/lib/learning/analyzeConversations.js", () => ({
  analyzeConversations: vi.fn().mockResolvedValue({ ranAnalysis: false, flaggedCallCount: 0, groupsConsidered: 0, suggestionIds: [] }),
}));

vi.mock("../../../src/lib/vaccinationReminders.js", () => ({
  enqueueDueVaccinationReminders: vi.fn().mockResolvedValue({
    scanned: 0,
    enqueued: 0,
    skippedNoPhone: 0,
    failed: 0,
  }),
}));

import { processNotifications } from "../../../src/services/notification.processor.js";
import { analyzeConversations } from "../../../src/lib/learning/analyzeConversations.js";
import { enqueueDueVaccinationReminders } from "../../../src/lib/vaccinationReminders.js";
import { vaccinationReminderRoutes } from "../../../src/server/routes/vaccinationReminders.js";

// JOBS_BEARER_TOKEN is set in tests/setup.ts: "test-bearer-token-1234567"
const VALID_TOKEN = "test-bearer-token-1234567";

function makeApp() {
  const app = new Hono();
  app.route("/jobs", jobsRoutes);
  app.route("/jobs", vaccinationReminderRoutes);
  return app;
}

beforeEach(() => {
  resetJobSecurityCaches();
  vi.clearAllMocks();
  vi.mocked(processNotifications).mockResolvedValue({ processed: 1, sent: 1, failed: 0, deferred: 0, expired: 0, remainingDue: 0 });
  vi.mocked(analyzeConversations).mockResolvedValue({ ranAnalysis: false, flaggedCallCount: 0, groupsConsidered: 0, suggestionIds: [] });
  vi.mocked(enqueueDueVaccinationReminders).mockResolvedValue({ scanned: 0, enqueued: 0, skippedNoPhone: 0, failed: 0 });
});

describe("POST /jobs/process-notifications", () => {
  it("returns 401 with no Authorization header", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", { method: "POST" });
    expect(res.status).toBe(401);
    expect(processNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
    expect(processNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 with malformed Authorization (no Bearer prefix)", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: VALID_TOKEN },
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 and calls processNotifications with valid token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(processNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "00000000-0000-4000-8000-000000000001" }),
    );

    const body = await res.json() as { processed: number; sent: number };
    expect(body.processed).toBe(1);
    expect(body.sent).toBe(1);
  });

  it("returns the same result for the same idempotency key and does not re-run the job", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "job-dup-123",
    };

    const first = await app.request("/jobs/process-notifications", {
      method: "POST",
      headers,
      body: JSON.stringify({ appointmentId: "appt-123" }),
    });
    const second = await app.request("/jobs/process-notifications", {
      method: "POST",
      headers,
      body: JSON.stringify({ appointmentId: "appt-123" }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(processNotifications).toHaveBeenCalledTimes(1);
  });

  it("rate-limits repeated requests from the same caller", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.10",
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await app.request("/jobs/process-notifications", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/jobs/process-notifications", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    expect(blocked.status).toBe(429);
  });

  it("does not rate-limit retries for a cached idempotency key", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "job-retry-123",
      "X-Forwarded-For": "203.0.113.10",
    };

    for (let i = 0; i < 6; i += 1) {
      const res = await app.request("/jobs/process-notifications", {
        method: "POST",
        headers,
        body: JSON.stringify({ appointmentId: "appt-123" }),
      });
      expect(res.status).toBe(200);
    }

    expect(processNotifications).toHaveBeenCalledTimes(1);
  });

  it("scopes idempotency keys to each job route", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "shared-key",
    };

    const notificationRes = await app.request("/jobs/process-notifications", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const analysisRes = await app.request("/jobs/analyze-conversations", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    expect(notificationRes.status).toBe(200);
    expect(analysisRes.status).toBe(200);
    expect(processNotifications).toHaveBeenCalledTimes(1);
    expect(analyzeConversations).toHaveBeenCalledTimes(1);
  });

  it("passes appointmentId from body to processNotifications", async () => {
    const app = makeApp();
    await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ appointmentId: "appt-123" }),
    });
    expect(processNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: "appt-123" }),
    );
  });

  // Was "passes clinicId from body to processNotifications". JOBS_BEARER_TOKEN
  // is one shared secret, so honouring a caller-supplied clinic meant anyone
  // holding it could have this agent process another tenant's queue.
  it("ignores a caller-supplied clinicId and uses its own", async () => {
    const app = makeApp();
    await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ clinicId: "clinic-456" }),
    });
    expect(processNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "00000000-0000-4000-8000-000000000001" }),
    );
  });

  it("returns 500 when processNotifications throws", async () => {
    vi.mocked(processNotifications).mockRejectedValueOnce(new Error("DB down"));
    const app = makeApp();
    const res = await app.request("/jobs/process-notifications", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("DB down");
  });
});

describe("POST /jobs/analyze-conversations", () => {
  it("returns 401 with no Authorization header", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/analyze-conversations", { method: "POST" });
    expect(res.status).toBe(401);
    expect(analyzeConversations).not.toHaveBeenCalled();
  });

  it("returns 401 with wrong token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/analyze-conversations", {
      method:  "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
    expect(analyzeConversations).not.toHaveBeenCalled();
  });

  it("returns 200 and calls analyzeConversations with valid token", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/analyze-conversations", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(analyzeConversations).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });

  it("ignores a caller-supplied clinicId and analyses its own", async () => {
    const app = makeApp();
    await app.request("/jobs/analyze-conversations", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ clinicId: "clinic-456" }),
    });
    expect(analyzeConversations).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });

  it("returns 500 when analyzeConversations throws", async () => {
    vi.mocked(analyzeConversations).mockRejectedValueOnce(new Error("ANTHROPIC_API_KEY is not configured"));
    const app = makeApp();
    const res = await app.request("/jobs/analyze-conversations", {
      method:  "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("ANTHROPIC_API_KEY is not configured");
  });
});

describe("POST /jobs/send-vaccination-reminders", () => {
  it("returns 401 with no Authorization header", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/send-vaccination-reminders", { method: "POST" });
    expect(res.status).toBe(401);
    expect(enqueueDueVaccinationReminders).not.toHaveBeenCalled();
  });

  it("pins the scan to AGENT_CLINIC_ID and ignores a caller-supplied clinicId", async () => {
    const app = makeApp();
    const res = await app.request("/jobs/send-vaccination-reminders", {
      method: "POST",
      headers: { Authorization: `Bearer ${VALID_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId: "clinic-456" }),
    });
    expect(res.status).toBe(200);
    expect(enqueueDueVaccinationReminders).toHaveBeenCalledWith();
  });

  it("returns the same result for the same idempotency key and does not re-run the scan", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "vacc-dup-123",
    };

    const first = await app.request("/jobs/send-vaccination-reminders", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const second = await app.request("/jobs/send-vaccination-reminders", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(enqueueDueVaccinationReminders).toHaveBeenCalledTimes(1);
  });

  it("rate-limits repeated requests from the same caller", async () => {
    const app = makeApp();
    const headers = {
      Authorization: `Bearer ${VALID_TOKEN}`,
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.99",
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await app.request("/jobs/send-vaccination-reminders", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/jobs/send-vaccination-reminders", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(blocked.status).toBe(429);
  });
});
