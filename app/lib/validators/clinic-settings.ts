import { z } from "zod";
import { SMS_TEMPLATE_REQUIRED_FIELDS, extractPlaceholders, type SmsTemplateKey } from "@tomer/shared";

// Shared with the settings page UI so "+ add row" stops at the same cap the API enforces.
export const MAX_BUSINESS_HOURS_ROWS = 10;
export const MAX_VISIT_PRICE_ROWS = 20;

const businessHourEntrySchema = z.object({
  day: z.string().trim().min(1).max(60),
  hours: z.string().trim().min(1).max(60),
});

const visitPriceEntrySchema = z.object({
  label: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(120),
});

const contactSchema = z.object({
  address: z.string().trim().max(200),
  whatsapp: z.string().trim().max(40),
  email: z.string().trim().max(120),
});

const SMS_TEMPLATE_KEYS = Object.keys(SMS_TEMPLATE_REQUIRED_FIELDS) as SmsTemplateKey[];

const smsTemplatesSchema = z
  .record(z.string(), z.string().trim().min(1).max(2000))
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      if (!(SMS_TEMPLATE_KEYS as string[]).includes(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `מפתח תבנית לא מוכר: ${key}`, path: [key] });
      }
    }
    for (const [key, text] of Object.entries(obj)) {
      const required = SMS_TEMPLATE_REQUIRED_FIELDS[key as SmsTemplateKey] ?? [];
      const present = extractPlaceholders(text);
      const missing = required.filter((field) => !present.has(field));
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `חסרים שדות חובה בתבנית "${key}": ${missing.join(", ")}`,
          path: [key],
        });
      }
    }
  });

export const updateClinicSettingsSchema = z.object({
  businessHours: z.array(businessHourEntrySchema).min(1).max(MAX_BUSINESS_HOURS_ROWS).optional(),
  visitPrices: z.array(visitPriceEntrySchema).min(1).max(MAX_VISIT_PRICE_ROWS).optional(),
  contact: contactSchema.partial().optional(),
  smsTemplates: smsTemplatesSchema.optional(),
});

export type UpdateClinicSettingsInput = z.infer<typeof updateClinicSettingsSchema>;
