import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants";

export const createMemeSchema = z.object({
  imageUrl: z.url(),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
});

export const updateMemeSchema = z.object({
  description: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const listMemesQuerySchema = z.object({
  cursor: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  q: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});
