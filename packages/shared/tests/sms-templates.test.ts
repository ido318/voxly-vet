import { describe, expect, it } from "vitest";
import {
  DEFAULT_SMS_TEMPLATE_TEXT,
  SMS_TEMPLATE_REQUIRED_FIELDS,
  renderSmsTemplate,
  extractPlaceholders,
  resolveSmsTemplate,
  smsTemplates,
} from "../src/sms-templates";

describe("renderSmsTemplate", () => {
  it("replaces {{key}} placeholders with matching data fields", () => {
    const result = renderSmsTemplate("שלום {{customerName}}, {{petName}} מחכה לך", {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe("שלום דנה, מיקה מחכה לך");
  });

  it("replaces a missing/undefined field with an empty string rather than leaving the placeholder", () => {
    const result = renderSmsTemplate("מועד: {{newTime}}", { customerName: "דנה", petName: "מיקה" });
    expect(result).toBe("מועד: ");
  });
});

describe("extractPlaceholders", () => {
  it("returns the set of distinct {{key}} names referenced in a template", () => {
    const result = extractPlaceholders("{{customerName}} {{petName}} {{customerName}}");
    expect(result).toEqual(new Set(["customerName", "petName"]));
  });

  it("returns an empty set for a template with no placeholders", () => {
    expect(extractPlaceholders("טקסט קבוע בלי משתנים")).toEqual(new Set());
  });
});

describe("resolveSmsTemplate", () => {
  it("uses the default template text when no custom text is given", () => {
    const result = resolveSmsTemplate("post_visit_followup", undefined, {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe(
      renderSmsTemplate(DEFAULT_SMS_TEMPLATE_TEXT.post_visit_followup, { customerName: "דנה", petName: "מיקה" }),
    );
  });

  it("uses the custom text when given, over the default", () => {
    const result = resolveSmsTemplate("post_visit_followup", "תודה {{customerName}}!", {
      customerName: "דנה",
      petName: "מיקה",
    });
    expect(result).toBe("תודה דנה!");
  });
});

describe("smsTemplates (backward-compatible external API)", () => {
  it("booking_confirmation still throws when a required field is missing", () => {
    expect(() =>
      smsTemplates.booking_confirmation({
        customerName: "דנה",
        petName: "מיקה",
      } as never),
    ).toThrow(/missing required fields/);
  });

  it("booking_confirmation renders identically to the old hardcoded template literal", () => {
    const data = {
      customerName: "דנה כהן",
      petName: "מיקה",
      dayName: "יום שלישי",
      date: "17.6.2026",
      time: "16:30",
      location: 'הקליניקה, הדוגמה 1 ת"א',
      visitType: "בדיקה",
      price: "150 ₪",
    };
    expect(smsTemplates.booking_confirmation(data)).toBe(
      `שלום ${data.customerName}, כאן תומר ממרפאת Demo Vet Clinic של ד"ר דנה כהן.\n` +
      `התור של ${data.petName} נקבע בהצלחה ✅\n` +
      `📅 ${data.dayName}, ${data.date} | 🕒 ${data.time} | 📍 ${data.location}\n` +
      `🩺 ${data.visitType} | 💳 ${data.price}\n` +
      `לשינוי או ביטול (חינם עד 4 שעות לפני התור) — חייגו אלינו.\n` +
      `מאחלים ל${data.petName} בריאות שלמה 🐾`,
    );
  });

  it("post_visit_followup (no required fields) still works with only customerName/petName", () => {
    expect(smsTemplates.post_visit_followup({ customerName: "דנה", petName: "מיקה" })).toContain("דנה");
  });
});
