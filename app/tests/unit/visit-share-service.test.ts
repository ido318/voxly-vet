import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { VisitShareService } from "@/lib/services/visit-share.service";
import type { ServiceActor } from "@/lib/services/service-context";

const { sendSmsMock } = vi.hoisted(() => ({ sendSmsMock: vi.fn() }));
vi.mock("@/lib/integrations/twilio/sms", () => ({
  sendSms: sendSmsMock,
}));

const CLINIC = "clinic-1";
const actor: ServiceActor = {
  userId: "user-1",
  clinicIds: [CLINIC],
  defaultClinicId: CLINIC,
  memberships: [{ clinicId: CLINIC, role: "veterinarian" }],
};

function makeVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: "visit-1",
    clinicId: CLINIC,
    customerId: "cust-1",
    petId: "pet-1",
    appointmentId: null,
    status: "completed",
    chiefComplaint: null,
    manualVisitSummary: null,
    aiVisitSummary: "סיכום ביקור לדוגמה",
    aiSummaryGeneratedAt: null,
    aiSummaryAcceptedByUserId: null,
    startedAt: "2026-08-12T08:00:00.000Z",
    completedAt: null,
    version: 1,
    createdByUserId: null,
    createdAt: "2026-08-12T08:00:00.000Z",
    updatedAt: "2026-08-12T08:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function buildService(
  visit: ReturnType<typeof makeVisit> | null,
  prescriptions: unknown[] = [],
  customer: { id: string; fullName: string; phone: string | null } | null = {
    id: "cust-1",
    fullName: "דנה",
    phone: "0501234567",
  },
) {
  const visitRepository = { findById: vi.fn(async () => ok(visit)) };
  const prescriptionRepository = { listByVisit: vi.fn(async () => ok(prescriptions)) };
  const customerRepository = { findById: vi.fn(async () => ok(customer)) };
  const petRepository = { findById: vi.fn(async () => ok({ id: "pet-1", name: "רקס" })) };
  const created = { id: "share-1", token: "tok" };
  const visitShareRepository = {
    create: vi.fn(async () => ok(created)),
    markSent: vi.fn(async () => ok({ ...created, sentAt: "now" })),
    revoke: vi.fn(async () => ok({ ...created, revokedAt: "now" })),
  };
  const auditService = { logAction: vi.fn(async () => ok({})) };

  const service = new VisitShareService(
    visitRepository as never,
    customerRepository as never,
    petRepository as never,
    prescriptionRepository as never,
    visitShareRepository as never,
    auditService as never,
  );
  return { service, visitShareRepository, auditService, sendSmsMock };
}

beforeEach(() => {
  sendSmsMock.mockReset();
  sendSmsMock.mockResolvedValue({ sid: "SM123" });
});

describe("VisitShareService.createAndSend", () => {
  it("creates share links that expire after 7 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T10:00:00.000Z"));
    try {
      const { service, visitShareRepository } = buildService(makeVisit());

      const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

      expect(result.ok).toBe(true);
      expect(visitShareRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: "2026-09-04T10:00:00.000Z",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates a share, sends an SMS with the link, and returns the url", async () => {
    const { service, visitShareRepository, auditService } = buildService(makeVisit());

    const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toMatch(/^https:\/\/app\.test\/s\//);
    expect(result.value.recipientPhone).toBe("0501234567");
    expect(sendSmsMock).toHaveBeenCalledOnce();
    const [to, body] = sendSmsMock.mock.calls[0]!;
    expect(to).toBe("0501234567");
    expect(body).toContain(result.value.url);
    expect(visitShareRepository.markSent).toHaveBeenCalledWith("share-1", "SM123");
    expect(auditService.logAction).toHaveBeenCalledOnce();
  });

  it("uses APP_BASE_URL when no explicit origin is provided", async () => {
    const { service } = buildService(makeVisit());

    const result = await service.createAndSend(actor, "visit-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toMatch(/^http:\/\/localhost:3000\/s\//);
    const [, body] = sendSmsMock.mock.calls[0]!;
    expect(body).toContain(result.value.url);
  });

  it("rejects when there is no summary and no active prescription", async () => {
    const { service } = buildService(makeVisit({ aiVisitSummary: null, manualVisitSummary: null }), []);

    const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("forbids sending when the visit belongs to another clinic", async () => {
    const { service } = buildService(makeVisit({ clinicId: "other-clinic" }));

    const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("rejects when the customer has no phone number", async () => {
    const { service } = buildService(makeVisit(), [], {
      id: "cust-1",
      fullName: "דנה",
      phone: null,
    });

    const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("revokes the share and returns an error when SMS delivery fails", async () => {
    const { service, visitShareRepository } = buildService(makeVisit());
    sendSmsMock.mockRejectedValueOnce(new Error("twilio down"));

    const result = await service.createAndSend(actor, "visit-1", { origin: "https://app.test" });

    expect(result.ok).toBe(false);
    expect(visitShareRepository.create).toHaveBeenCalledOnce();
    expect(visitShareRepository.revoke).toHaveBeenCalledWith("share-1");
    expect(visitShareRepository.markSent).not.toHaveBeenCalled();
  });
});
