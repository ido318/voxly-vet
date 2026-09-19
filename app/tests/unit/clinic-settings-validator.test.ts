import { describe, expect, it } from "vitest";
import { updateClinicSettingsSchema } from "@/lib/validators/clinic-settings";

describe("updateClinicSettingsSchema — smsTemplates", () => {
  it("accepts a valid override that keeps every required placeholder", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: {
        cancellation_update: "ביטלנו את התור מיום {{oldDate}}, {{customerName}}. מצטערים!",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an override missing a required placeholder", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: {
        cancellation_update: "ביטלנו את התור, {{customerName}}. מצטערים!",
      },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toContain("oldDate");
  });

  it("rejects an unrecognized template key", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { not_a_real_template: "טקסט" },
    });
    expect(result.success).toBe(false);
  });

  it("allows a template with no required fields (post_visit_followup) to be any non-empty text", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { post_visit_followup: "תודה שביקרתם, {{customerName}}!" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty-string template", () => {
    const result = updateClinicSettingsSchema.safeParse({
      smsTemplates: { post_visit_followup: "" },
    });
    expect(result.success).toBe(false);
  });
});
