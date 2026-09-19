import { z } from "zod";
import { isValidIsraeliPhone } from "@tomer/shared";

export const customerStatusSchema = z.enum(["active", "inactive"]);
export const preferredContactMethodSchema = z.enum([
  "phone",
  "sms",
  "email",
  "whatsapp",
]);

const nullableTrimmed = z.string().trim().min(1).optional().nullable();

const israeliPhoneField = z
  .string()
  .trim()
  .refine(isValidIsraeliPhone, { message: "מספר טלפון ישראלי לא תקין" })
  .optional()
  .nullable();

export const customerTagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(10);

export const createCustomerSchema = z.object({
  clinicId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  // Was `nullableTrimmed`, i.e. any non-empty string. A dashboard-created
  // customer could be saved with a number Tomer can never match and Twilio
  // can never text.
  phone: israeliPhoneField,
  email: z.string().email().optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  preferredContactMethod: preferredContactMethodSchema.optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: customerStatusSchema.optional(),
  tags: customerTagsSchema.optional(),
});

export const updateCustomerSchema = createCustomerSchema
  .omit({ clinicId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const customerSearchSchema = z.object({
  clinicId: z.string().uuid().optional(),
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
