import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const { mockRequireProviderAdmin, mockCreateServices, mockRedirect } = vi.hoisted(() => ({
  mockRequireProviderAdmin: vi.fn(),
  mockCreateServices: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/api/provider-admin", () => ({
  requireProviderAdmin: mockRequireProviderAdmin,
}));
vi.mock("@/lib/services/factory", () => ({
  createServices: mockCreateServices,
}));
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { requireProviderAdminPage } from "@/lib/api/require-provider-admin-page";

describe("requireProviderAdminPage", () => {
  it("does nothing when the caller is a provider_admin", async () => {
    mockCreateServices.mockResolvedValue({ auth: {} });
    mockRequireProviderAdmin.mockResolvedValue({ user: { id: "u1" }, profile: { role: "provider_admin" } });

    await requireProviderAdminPage();

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard when the caller is unauthorized", async () => {
    mockCreateServices.mockResolvedValue({ auth: {} });
    mockRequireProviderAdmin.mockRejectedValue(AppError.unauthorized());

    await requireProviderAdminPage();

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard when the caller is forbidden", async () => {
    mockCreateServices.mockResolvedValue({ auth: {} });
    mockRequireProviderAdmin.mockRejectedValue(AppError.forbidden());

    await requireProviderAdminPage();

    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
