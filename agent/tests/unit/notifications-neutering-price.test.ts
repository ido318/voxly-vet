import { describe, expect, it } from "vitest";
import { smsTemplates, CLINIC_LOCATION } from "../../src/services/sms.templates.js";

/**
 * Mirror of app/tests/unit/dashboard-notifications-neutering-price.test.ts on the
 * agent side. The price is now a whole segment rather than a bare number, so a
 * service with no fixed price can say so instead of the template appending "₪"
 * to whatever it was handed.
 */

describe("booking_confirmation price segment", () => {
  it("renders a fixed price unchanged", () => {
    const body = smsTemplates.booking_confirmation({
      customerName: "דנה",
      petName: "רקס",
      dayName: "יום שלישי",
      date: "17.6.2026",
      time: "16:30",
      location: CLINIC_LOCATION,
      visitType: "בדיקה",
      price: "150 ₪",
    });

    expect(body).toContain("💳 150 ₪");
  });

  it("carries a no-fixed-price sentence without appending a currency sign", () => {
    const body = smsTemplates.booking_confirmation({
      customerName: "דנה",
      petName: "רקס",
      dayName: "יום שלישי",
      date: "17.6.2026",
      time: "16:30",
      location: CLINIC_LOCATION,
      visitType: "עיקור/סירוס",
      price: 'המחיר יימסר על ידי ד"ר דנה',
    });

    expect(body).toContain('💳 המחיר יימסר על ידי ד"ר דנה');
    expect(body).not.toMatch(/💳\s*\d/);
    expect(body).not.toContain("₪");
  });
});
