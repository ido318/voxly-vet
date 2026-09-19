import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationDispatcher, getAgentJobsConfig } from "@/lib/services/notification-dispatcher";

/**
 * The processor answers HTTP 200 whether it sent a message, deferred it for quiet
 * hours, watched Twilio reject the number, or claimed nothing at all. Treating
 * the status code as success would put "ה-SMS נשלח" back in front of the vet in
 * exactly the cases this change exists to stop.
 */

const KEYS = ["AGENT_BASE_URL", "JOBS_BEARER_TOKEN"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  process.env.AGENT_BASE_URL = "https://agent.example";
  process.env.JOBS_BEARER_TOKEN = "token-value";
});

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NotificationDispatcher", () => {
  it("reports dispatched only when the processor actually sent something", async () => {
    stubFetch({ processed: 1, sent: 1, failed: 0, deferred: 0, expired: 0 });

    expect(await new NotificationDispatcher().dispatch({ appointmentId: "a-1" })).toEqual({
      dispatched: true,
    });
  });

  it("does not report a send when the row was deferred for quiet hours", async () => {
    stubFetch({ processed: 0, sent: 0, failed: 0, deferred: 1, expired: 0 });

    const result = await new NotificationDispatcher().dispatch({ appointmentId: "a-1" });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain("quiet hours");
  });

  it("does not report a send when the provider rejected the message", async () => {
    stubFetch({ processed: 1, sent: 0, failed: 1, deferred: 0, expired: 0 });

    const result = await new NotificationDispatcher().dispatch({ appointmentId: "a-1" });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain("rejected");
  });

  it("does not report a send when nothing was claimed", async () => {
    stubFetch({ processed: 0, sent: 0, failed: 0, deferred: 0, expired: 0 });

    const result = await new NotificationDispatcher().dispatch({ appointmentId: "a-1" });
    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain("no matching message");
  });

  it("treats an unreadable body as not sent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    expect((await new NotificationDispatcher().dispatch({})).dispatched).toBe(false);
  });

  it("passes the target through and authenticates with the jobs token", async () => {
    const fetchMock = stubFetch({ sent: 1 });

    await new NotificationDispatcher().dispatch({ appointmentId: "a-9" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://agent.example/jobs/process-notifications");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-value");
    expect(JSON.parse(init.body as string)).toEqual({ appointmentId: "a-9" });
  });

  it("is inert, not fatal, when the agent endpoint is not configured", async () => {
    delete process.env.AGENT_BASE_URL;
    const fetchMock = stubFetch({ sent: 1 });

    const result = await new NotificationDispatcher().dispatch({});
    expect(result.dispatched).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAgentJobsConfig()).toBeNull();
  });

  it("survives a network failure — the row stays queued for cron", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await new NotificationDispatcher().dispatch({});
    expect(result.dispatched).toBe(false);
    expect(result.reason).toContain("ECONNREFUSED");
  });
});
