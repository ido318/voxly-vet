import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheck = vi.fn();
const mockCreateAdminServices = vi.fn();

vi.mock("@/lib/services/factory", () => ({
  createAdminServices: () => mockCreateAdminServices(),
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockCheck.mockReset();
    mockCreateAdminServices.mockReset();
    mockCreateAdminServices.mockReturnValue({
      health: { check: mockCheck },
    });
    mockCheck.mockResolvedValue({
      ok: true,
      value: {
        status: "ok",
        env: "test",
        timestamp: "2026-08-22T00:00:00.000Z",
        db: "connected",
      },
    });
  });

  it("returns public liveness without exposing DB or env details", async () => {
    vi.stubEnv("HEALTH_CHECK_TOKEN", "internal-health-token-123");
    const { GET } = await import("@/app/api/health/route");

    const response = await GET(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.timestamp).toEqual(expect.any(String));
    expect(body.data).not.toHaveProperty("env");
    expect(body.data).not.toHaveProperty("db");
    expect(mockCreateAdminServices).not.toHaveBeenCalled();
  });

  it("returns detailed health only with the internal bearer token", async () => {
    vi.stubEnv("HEALTH_CHECK_TOKEN", "internal-health-token-123");
    const { GET } = await import("@/app/api/health/route");

    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { Authorization: "Bearer internal-health-token-123" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.env).toBe("test");
    expect(body.data.db).toBe("connected");
    expect(mockCreateAdminServices).toHaveBeenCalledTimes(1);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it("does not expose detailed health for an incorrect bearer token", async () => {
    vi.stubEnv("HEALTH_CHECK_TOKEN", "internal-health-token-123");
    const { GET } = await import("@/app/api/health/route");

    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("ok");
    expect(body.data).not.toHaveProperty("env");
    expect(body.data).not.toHaveProperty("db");
    expect(mockCreateAdminServices).not.toHaveBeenCalled();
  });

  it("requires a trusted source IP before revealing detailed health", async () => {
    vi.stubEnv("HEALTH_CHECK_TOKEN", "internal-health-token-123");
    vi.stubEnv("HEALTH_CHECK_ALLOWED_IPS", "203.0.113.10");
    const { GET } = await import("@/app/api/health/route");

    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: {
          Authorization: "Bearer internal-health-token-123",
          "X-Forwarded-For": "198.51.100.7",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("ok");
    expect(body.data).not.toHaveProperty("env");
    expect(body.data).not.toHaveProperty("db");
    expect(mockCreateAdminServices).not.toHaveBeenCalled();
  });

  it("allows detailed health from an explicitly trusted IP", async () => {
    vi.stubEnv("HEALTH_CHECK_TOKEN", "internal-health-token-123");
    vi.stubEnv("HEALTH_CHECK_ALLOWED_IPS", "203.0.113.10");
    const { GET } = await import("@/app/api/health/route");

    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: {
          Authorization: "Bearer internal-health-token-123",
          "X-Forwarded-For": "203.0.113.10",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.env).toBe("test");
    expect(body.data.db).toBe("connected");
    expect(mockCreateAdminServices).toHaveBeenCalledTimes(1);
  });
});
