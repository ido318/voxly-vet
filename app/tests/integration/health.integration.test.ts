import { afterAll, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { createAdminServices } from "@/lib/services/factory";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true";

describe.runIf(runIntegration)("HealthService", () => {
  afterAll(() => {
    resetEnvCache();
  });

  it("reports connected database status", async () => {
    const { health } = createAdminServices();
    const result = await health.check();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("ok");
      expect(result.value.db).toBe("connected");
    }
  });
});
