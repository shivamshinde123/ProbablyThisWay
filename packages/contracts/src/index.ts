import { z } from "zod";

export const hikeSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().min(1),
  difficulty: z.enum(["easy", "moderate", "hard"]),
  distanceMiles: z.number().positive(),
  elevationGainFeet: z.number().nonnegative(),
});
export type HikeSummary = z.infer<typeof hikeSummarySchema>;
export const hikesResponseSchema = z.object({ items: z.array(hikeSummarySchema) });
