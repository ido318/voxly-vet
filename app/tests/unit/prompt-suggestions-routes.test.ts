import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ok } from "@/lib/errors/app-error";
import { GET } from "@/app/api/prompt-suggestions/route";
import { POST as rejectRoute } from "@/app/api/prompt-suggestions/[id]/reject/route";
import { POST as approveRoute } from "@/app/api/prompt-suggestions/[id]/approve/route";
import { POST as consolidateRoute } from "@/app/api/prompt-suggestions/consolidate/route";

const { mockRequireProviderAdmin, mockCreateServices } = vi.hoisted(() => ({
  mockRequireProviderAdmin: vi.fn(),
  mockCreateServices: vi.fn(),
}));

vi.mock("@/lib/api/provider-admin", () => ({
  requireProviderAdmin: mockRequireProviderAdmin,
}));

vi.mock("@/lib/services/factory", () => ({
  createServices: mockCreateServices,
}));

const adminUser = { id: "admin-1" };

function mockServices(promptSuggestion: Record<string, unknown>) {
  mockCreateServices.mockResolvedValue({ auth: {}, promptSuggestion });
}

describe("prompt-suggestions API routes", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("GET /prompt-suggestions returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("GET /prompt-suggestions returns 403 for a non-provider-admin", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("GET /prompt-suggestions lists pending suggestions with no actor argument", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const listPending = vi.fn().mockResolvedValue(ok([{ id: "sugg-1", status: "pending" }]));
    mockServices({ listPending });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listPending).toHaveBeenCalledWith();
  });

  it("POST reject returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("POST reject delegates to the service with the user id and suggestion id", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const reject = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "rejected" }));
    mockServices({ reject });
    const response = await rejectRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/reject", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    expect(response.status).toBe(200);
    expect(reject).toHaveBeenCalledWith(adminUser.id, "sugg-1");
  });

  it("POST approve returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("POST approve reports published:false when regression could not be confirmed", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "pending" }));
    mockServices({ approve });
    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };
    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(approve).toHaveBeenCalledWith(adminUser.id, "sugg-1");
  });

  it("POST approve reports published:true on a successful publish", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "published" }));
    mockServices({ approve });
    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean } };
    expect(response.status).toBe(200);
    expect(body.data.published).toBe(true);
  });

  it("POST approve reports a non-empty message for the 'approved' status (non-prompt category, no regression run)", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const approve = vi.fn().mockResolvedValue(ok({ id: "sugg-1", status: "approved" }));
    mockServices({ approve });
    const response = await approveRoute(
      new Request("http://localhost/api/prompt-suggestions/sugg-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "sugg-1" }) },
    );
    const body = (await response.json()) as { data: { published: boolean; message: string } };
    expect(response.status).toBe(200);
    expect(body.data.published).toBe(false);
    expect(body.data.message).not.toBe("");
  });
});

describe("POST /api/prompt-suggestions/consolidate", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await consolidateRoute();
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-provider-admin", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());
    const response = await consolidateRoute();
    expect(response.status).toBe(403);
  });

  it("returns 409 when the service reports too few candidates", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const consolidatePending = vi.fn().mockResolvedValue(
      { ok: false, error: AppError.conflict("At least 2 pending 'prompt' suggestions are required to consolidate") },
    );
    mockServices({ consolidatePending });
    const response = await consolidateRoute();
    expect(response.status).toBe(409);
  });

  it("delegates to the service and returns the merged suggestion on success", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const merged = { id: "merged-1", status: "pending", category: "prompt" };
    const consolidatePending = vi.fn().mockResolvedValue(ok(merged));
    mockServices({ consolidatePending });
    const response = await consolidateRoute();
    const body = (await response.json()) as { data: typeof merged };
    expect(response.status).toBe(200);
    expect(body.data).toEqual(merged);
    expect(consolidatePending).toHaveBeenCalledWith();
  });
});
