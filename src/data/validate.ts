import { z } from "zod";
import type { LyricStanza } from "./types";

export const LyricVerseSchema = z
  .object({
    start_time: z.number().optional(),
    end_time: z.number().optional(),
    text: z.string(),
    comment: z.string().optional(),
    audio_track_ids: z.array(z.number()).optional(),
    color_keys: z.array(z.string()).optional()
  })
  .strict();

export const LyricStanzaSchema: z.ZodType<LyricStanza> = z.array(
  z.union([LyricVerseSchema, z.array(z.array(LyricVerseSchema))])
);

export const LyricStanzaArraySchema = z.array(LyricStanzaSchema);

export function lyricStanzaArrayValidation(data: unknown) {
  return LyricStanzaArraySchema.safeParse(data);
}
