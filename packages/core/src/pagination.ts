import { z } from "zod";

export const CursorPageRequest = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
export type CursorPageRequest = z.infer<typeof CursorPageRequest>;

export const cursorPage = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
