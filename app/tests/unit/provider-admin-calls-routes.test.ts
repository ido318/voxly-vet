import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ok } from "@/lib/errors/app-error";
import { GET as listRoute } from "@/app/api/provider-admin/calls/route";
import { GET as detailRoute } from "@/app/api/provider-admin/calls/[id]/route";

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

function mockCallReviewService(callReview: Record<string, unknown>) {
  mockCreateServices.mockResolvedValue({ auth: {}, callReview });
}

describe("GET /api/provider-admin/calls", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await listRoute(new Request("http://localhost/api/provider-admin/calls"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-provider-admin", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());
    const response = await listRoute(new Request("http://localhost/api/provider-admin/calls"));
    expect(response.status).toBe(403);
  });

  it("parses severity and page query params and delegates to the service", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const list = vi.fn().mockResolvedValue(ok({ items: [], total: 0 }));
    mockCallReviewService({ list });
    const response = await listRoute(
      new Request("http://localhost/api/provider-admin/calls?severity=medium&page=2"),
    );
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ severity: "medium", page: 2 });
  });

  it("defaults to severity=all and page=1 when params are absent", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const list = vi.fn().mockResolvedValue(ok({ items: [], total: 0 }));
    mockCallReviewService({ list });
    await listRoute(new Request("http://localhost/api/provider-admin/calls"));
    expect(list).toHaveBeenCalledWith({ severity: "all", page: 1 });
  });
});

describe("GET /api/provider-admin/calls/[id]", () => {
  beforeEach(() => {
    mockRequireProviderAdmin.mockReset();
    mockCreateServices.mockReset();
    mockCreateServices.mockResolvedValue({ auth: {} });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());
    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/cr-1"),
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when the call review does not exist", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    mockCallReviewService({ getWithLinkedSuggestion: vi.fn().mockResolvedValue(ok(null)) });
    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns the review with its linked suggestion", async () => {
    mockRequireProviderAdmin.mockResolvedValue({ user: adminUser });
    const payload = { review: { id: "cr-1" }, linkedSuggestion: null };
    mockCallReviewService({ getWithLinkedSuggestion: vi.fn().mockResolvedValue(ok(payload)) });
    const response = await detailRoute(
      new Request("http://localhost/api/provider-admin/calls/cr-1"),
      { params: Promise.resolve({ id: "cr-1" }) },
    );
    const body = (await response.json()) as { data: typeof payload };
    expect(response.status).toBe(200);
    expect(body.data).toEqual(payload);
  });
});
