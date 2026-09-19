import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { AIEventService } from "@/lib/services/ai-event.service";
import { AuditService } from "@/lib/services/audit.service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(supabaseUrl && serviceRoleKey);

describe.runIf(runIntegration)("audit and ai event services", () => {
  const clinicId = "00000000-0000-4000-8000-000000000001";
  let adminClient: ReturnType<typeof createClient>;

  beforeAll(() => {
    resetEnvCache();
    adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    await adminClient
      .from("ai_events")
      .delete()
      .eq("event_type", "foundation_check");
    await adminClient
      .from("audit_logs")
      .delete()
      .eq("action", "foundation_check");
  });

  it("creates audit log entries via AuditService", async () => {
    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const result = await auditService.logAction({
      clinicId,
      actorType: "system",
      actorId: "phase1-test",
      action: "foundation_check",
      entityType: "system",
      entityId: "phase1",
      metadata: { phase: 1 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBeTruthy();
    }
  });

  it("creates AI events via AIEventService", async () => {
    const aiEventService = new AIEventService(
      new AIEventRepository(adminClient),
    );
    const result = await aiEventService.logEvent({
      clinicId,
      sourceType: "test",
      agentName: "tomer",
      eventType: "foundation_check",
      inputPayload: { hello: "world" },
      outputPayload: { ok: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.clinicId).toBe(clinicId);
    }
  });
});
