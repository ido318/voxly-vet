import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { AiArtifactService } from "@/lib/services/ai-artifact.service";
import type { AIEventService } from "@/lib/services/ai-event.service";
import type { ServiceActor } from "@/lib/services/service-context";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const vetActor: ServiceActor = {
  userId: "vet1",
  clinicIds: ["clinic1"],
  defaultClinicId: "clinic1",
  memberships: [{ clinicId: "clinic1", role: "veterinarian" }],
};

const staffActor: ServiceActor = {
  ...vetActor,
  memberships: [{ clinicId: "clinic1", role: "staff" }],
};

function artifact(overrides = {}) {
  return {
    id: "artifact1",
    clinicId: "clinic1",
    artifactType: "patient_summary",
    sourceType: "pet",
    sourceId: "pet1",
    status: "draft",
    draftText: "טיוטה",
    structuredPayload: {},
    modelName: "deterministic-draft",
    promptVersion: "phase9-v1",
    createdByUserId: "vet1",
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

/** A no-op-by-default AIEventService fake; callers override the methods they need to assert on. */
function fakeAiEventService(overrides: Partial<AIEventService> = {}): AIEventService {
  return {
    logEvent: vi.fn().mockResolvedValue(ok(artifact({ id: "event1" }))),
    countVisitSummaryGenerationsSince: vi.fn().mockResolvedValue(ok(0)),
    countArtifactGenerationsSince: vi.fn().mockResolvedValue(ok(0)),
    ...overrides,
  } as unknown as AIEventService;
}

describe("Phase 9 AI artifacts", () => {
  it("creates AI output as draft artifact only", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(ok(artifact())),
    };
    const service = new AiArtifactService(repository as never, fakeAiEventService());

    const result = await service.generateArtifact(vetActor, "draft_soap", {
      clinicId: "clinic1",
      sourceType: "visit",
      sourceId: "visit1",
      sourceText: "הכלב מקיא. לבדוק שתייה.",
    });

    expect(result.ok).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      artifactType: "draft_soap",
      structuredPayload: expect.objectContaining({ subjective: expect.any(String) }),
    }));
  });

  it("allows veterinarian to approve and records reviewer", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn().mockResolvedValue(ok(artifact({
        status: "approved",
        reviewedByUserId: "vet1",
      }))),
    };
    const service = new AiArtifactService(repository as never, fakeAiEventService());

    const result = await service.approveArtifact(vetActor, "artifact1");

    expect(result.ok).toBe(true);
    expect(repository.review).toHaveBeenCalledWith("artifact1", {
      status: "approved",
      reviewedByUserId: "vet1",
    });
  });

  it("rejects staff approval", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn(),
    };
    const service = new AiArtifactService(repository as never, fakeAiEventService());

    const result = await service.approveArtifact(staffActor, "artifact1");

    expect(result.ok).toBe(false);
    expect(repository.review).not.toHaveBeenCalled();
  });

  it("stores rejection reason", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(ok(artifact())),
      review: vi.fn().mockResolvedValue(ok(artifact({
        status: "rejected",
        reviewedByUserId: "vet1",
        rejectionReason: "לא מדויק",
      }))),
    };
    const service = new AiArtifactService(repository as never, fakeAiEventService());

    const result = await service.rejectArtifact(vetActor, "artifact1", "לא מדויק");

    expect(result.ok).toBe(true);
    expect(repository.review).toHaveBeenCalledWith("artifact1", {
      status: "rejected",
      reviewedByUserId: "vet1",
      rejectionReason: "לא מדויק",
    });
  });

  it("exposes API routes and approval UI components", () => {
    expect(source("app/api/ai/patient-summary/route.ts")).toContain("patient_summary");
    expect(source("app/api/ai/draft-soap/route.ts")).toContain("draft_soap");
    expect(source("app/api/ai/draft-client-instructions/route.ts")).toContain("client_instructions");
    expect(source("app/api/ai/extract-tasks/route.ts")).toContain("extracted_tasks");
    expect(source("components/dashboard/ai/ai-draft-panel.tsx")).toContain("ApprovalControls");
    expect(source("components/dashboard/ai/ai-safety-notice.tsx")).toContain("אינה רשומה רשמית");
  });

  describe("draft_soap real LLM generation", () => {
    const generateInput = {
      clinicId: "clinic1",
      sourceType: "visit" as const,
      sourceId: "visit1",
      sourceText: "הכלב הקיא פעמיים הבוקר ולא אוכל.",
    };

    it("uses an injected soapNoteProvider to produce a mapped structuredPayload and real modelName, and logs the generation", async () => {
      const repository = {
        create: vi.fn().mockResolvedValue(ok(artifact({ artifactType: "draft_soap" }))),
      };
      const aiEventService = fakeAiEventService();
      const soapNoteProvider = {
        parseTranscript: vi.fn().mockResolvedValue({
          draft: { S: "תלונה מהבעלים", O: "ממצאי בדיקה", A: "אבחנה משוערת", P: "תוכנית טיפול" },
          modelName: "gpt-4o-mini",
        }),
      };
      const service = new AiArtifactService(repository as never, aiEventService, soapNoteProvider);

      const result = await service.generateArtifact(vetActor, "draft_soap", generateInput);

      expect(result.ok).toBe(true);
      expect(soapNoteProvider.parseTranscript).toHaveBeenCalledWith(generateInput.sourceText);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        artifactType: "draft_soap",
        modelName: "gpt-4o-mini",
        structuredPayload: {
          subjective: "תלונה מהבעלים",
          objective: "ממצאי בדיקה",
          assessment: "אבחנה משוערת",
          plan: "תוכנית טיפול",
        },
      }));
      expect(aiEventService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        clinicId: "clinic1",
        sourceType: "visit",
        sourceId: "visit1",
        eventType: "soap_note_generated",
        modelName: "gpt-4o-mini",
      }));
    });

    it("falls back to the deterministic stub exactly as before when OpenAI isn't configured and no provider is injected", async () => {
      // The dev shell running these tests may have a real OPENAI_API_KEY set
      // (e.g. for manual/live testing elsewhere) — force it unset here so
      // this test genuinely exercises the "not configured" fallback branch
      // regardless of the ambient environment. Mirrors the save/restore
      // pattern used in tests/unit/soap-note-provider.test.ts.
      const originalOpenAiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const repository = {
        create: vi.fn().mockResolvedValue(ok(artifact({ artifactType: "draft_soap" }))),
      };
      const aiEventService = fakeAiEventService();
      const service = new AiArtifactService(repository as never, aiEventService);

      const result = await service.generateArtifact(vetActor, "draft_soap", generateInput);

      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }

      expect(result.ok).toBe(true);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        artifactType: "draft_soap",
        modelName: "deterministic-draft",
        structuredPayload: {
          subjective: generateInput.sourceText,
          objective: "",
          assessment: "",
          plan: "",
        },
      }));
      // The stub path makes no external call, so it must not rate-limit or log.
      expect(aiEventService.countArtifactGenerationsSince).not.toHaveBeenCalled();
      expect(aiEventService.logEvent).not.toHaveBeenCalled();
    });

    it("returns 503 in production when OpenAI is missing and no provider is injected", async () => {
      const originalOpenAiKey = process.env.OPENAI_API_KEY;
      const originalAppEnv = process.env.APP_ENV;
      delete process.env.OPENAI_API_KEY;
      process.env.APP_ENV = "production";

      try {
        const repository = {
          create: vi.fn(),
        };
        const service = new AiArtifactService(repository as never, fakeAiEventService());

        const result = await service.generateArtifact(vetActor, "draft_soap", generateInput);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.status).toBe(503);
          expect(result.error.message).toMatch(/OPENAI_API_KEY/);
        }
        expect(repository.create).not.toHaveBeenCalled();
      } finally {
        if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = originalOpenAiKey;
        if (originalAppEnv === undefined) delete process.env.APP_ENV;
        else process.env.APP_ENV = originalAppEnv;
      }
    });

    it("rejects the 6th generation within an hour for the same source", async () => {
      const repository = {
        create: vi.fn(),
      };
      const aiEventService = fakeAiEventService({
        countArtifactGenerationsSince: vi.fn().mockResolvedValue(ok(5)),
      });
      const soapNoteProvider = {
        parseTranscript: vi.fn().mockResolvedValue({
          draft: { S: "s", O: "o", A: "a", P: "p" },
          modelName: "gpt-4o-mini",
        }),
      };
      const service = new AiArtifactService(repository as never, aiEventService, soapNoteProvider);

      const result = await service.generateArtifact(vetActor, "draft_soap", generateInput);

      expect(result.ok).toBe(false);
      expect(aiEventService.countArtifactGenerationsSince).toHaveBeenCalledWith(
        "visit1",
        "soap_note_generated",
        expect.any(String),
      );
      expect(soapNoteProvider.parseTranscript).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("other artifact types are unaffected", () => {
    it("keeps patient_summary fully deterministic and does not touch the SOAP rate limiter", async () => {
      const repository = {
        create: vi.fn().mockResolvedValue(ok(artifact({ artifactType: "patient_summary" }))),
      };
      const aiEventService = fakeAiEventService();
      const service = new AiArtifactService(repository as never, aiEventService);

      const result = await service.generateArtifact(vetActor, "patient_summary", {
        clinicId: "clinic1",
        sourceType: "pet",
        sourceId: "pet1",
        sourceText: "חתול בריא, ביקורת שנתית.",
      });

      expect(result.ok).toBe(true);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        artifactType: "patient_summary",
        modelName: "deterministic-draft",
        structuredPayload: { sourceLength: "חתול בריא, ביקורת שנתית.".length },
      }));
      expect(aiEventService.logEvent).not.toHaveBeenCalled();
      expect(aiEventService.countArtifactGenerationsSince).not.toHaveBeenCalled();
    });

    it("keeps extracted_tasks fully deterministic", async () => {
      const repository = {
        create: vi.fn().mockResolvedValue(ok(artifact({ artifactType: "extracted_tasks" }))),
      };
      const service = new AiArtifactService(repository as never, fakeAiEventService());

      const result = await service.generateArtifact(vetActor, "extracted_tasks", {
        clinicId: "clinic1",
        sourceType: "visit",
        sourceId: "visit1",
        sourceText: "לתאם ביקורת חוזרת. לשלוח מרשם.",
      });

      expect(result.ok).toBe(true);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        artifactType: "extracted_tasks",
        modelName: "deterministic-draft",
        structuredPayload: expect.objectContaining({ tasks: expect.any(Array) }),
      }));
    });

    it("returns 503 for stub-only artifact types in production", async () => {
      const originalAppEnv = process.env.APP_ENV;
      process.env.APP_ENV = "production";

      try {
        const repository = { create: vi.fn() };
        const service = new AiArtifactService(repository as never, fakeAiEventService());
        const result = await service.generateArtifact(vetActor, "patient_summary", {
          clinicId: "clinic1",
          sourceType: "pet",
          sourceId: "pet1",
          sourceText: "חתול בריא, ביקורת שנתית.",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.status).toBe(503);
        expect(repository.create).not.toHaveBeenCalled();
      } finally {
        if (originalAppEnv === undefined) delete process.env.APP_ENV;
        else process.env.APP_ENV = originalAppEnv;
      }
    });
  });
});
