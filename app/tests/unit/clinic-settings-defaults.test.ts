import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLINIC_SETTINGS,
  withClinicSettingsDefaults,
} from "@/lib/clinic-settings-defaults";

describe("withClinicSettingsDefaults", () => {
  it("falls back to defaults when a key was never stored", () => {
    const result = withClinicSettingsDefaults({});
    expect(result.businessHours).toEqual(DEFAULT_CLINIC_SETTINGS.businessHours);
    expect(result.visitPrices).toEqual(DEFAULT_CLINIC_SETTINGS.visitPrices);
  });

  it("falls back to defaults for null/undefined input", () => {
    expect(withClinicSettingsDefaults(null)).toEqual(DEFAULT_CLINIC_SETTINGS);
    expect(withClinicSettingsDefaults(undefined)).toEqual(DEFAULT_CLINIC_SETTINGS);
  });

  it("preserves a deliberately emptied list instead of reverting to defaults", () => {
    const result = withClinicSettingsDefaults({ businessHours: [], visitPrices: [] });
    expect(result.businessHours).toEqual([]);
    expect(result.visitPrices).toEqual([]);
  });

  it("merges partial contact info over the defaults", () => {
    const result = withClinicSettingsDefaults({ contact: { address: "כתובת חדשה", whatsapp: "", email: "" } });
    expect(result.contact.address).toBe("כתובת חדשה");
  });
});
