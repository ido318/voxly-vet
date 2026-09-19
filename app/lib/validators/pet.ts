import { z } from "zod";

export const petStatusSchema = z.enum(["active", "inactive"]);

const nullableTrimmed = z.string().trim().min(1).optional().nullable();

export const createPetSchema = z.object({
  clinicId: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  species: z.string().trim().min(1).max(80),
  breed: z.string().trim().max(120).optional().nullable(),
  sex: z.string().trim().max(30).optional().nullable(),
  birthDate: z.string().date().optional().nullable(),
  weight: z.number().positive().max(999.99).optional().nullable(),
  chipNumber: nullableTrimmed,
  isNeutered: z.boolean().optional(),
  allergies: z.string().trim().max(2000).optional().nullable(),
  chronicConditions: z.string().trim().max(2000).optional().nullable(),
  currentMedications: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  profileImageUrl: z.string().url().optional().nullable(),
  status: petStatusSchema.optional(),
});

export const updatePetSchema = createPetSchema
  .omit({ clinicId: true, customerId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const petSearchSchema = z.object({
  clinicId: z.string().uuid().optional(),
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
