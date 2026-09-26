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

export const trailCoordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number(),
]);

export const trailFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(trailCoordinateSchema).min(2),
  }),
  properties: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    dataQuality: z.enum(["preview", "authoritative"]),
  }),
});
export type TrailFeature = z.infer<typeof trailFeatureSchema>;

export const hikeDetailSchema = hikeSummarySchema.extend({
  trails: z.array(trailFeatureSchema).min(1),
});
export type HikeDetail = z.infer<typeof hikeDetailSchema>;
