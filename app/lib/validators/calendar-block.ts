import { z } from "zod";

export const listCalendarBlocksSchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export const createCalendarBlockSchema = z
  .object({
    clinicId: z.string().uuid(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .refine(
    (value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(),
    { path: ["endAt"], message: "endAt must be after startAt" },
  );
