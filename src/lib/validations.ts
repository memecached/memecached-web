import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants";
import { memes, tags, users } from "@/db/schema";

// --- Request schemas ---

export const createMemeSchema = z.object({
  imageUrl: z.url(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
});

export const updateMemeSchema = z.object({
  description: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).min(1).optional(),
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

export const dashboardMemesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  q: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  sortBy: z.enum(["createdAt", "description"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const bulkTagSchema = z.object({
  ids: z.array(z.uuid()).min(1),
  tags: z.array(z.string().min(1)).min(1),
});

export const updateUserSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

// --- Response types ---

export type Meme = typeof memes.$inferSelect & { tags: string[] };

export type Tag = typeof tags.$inferSelect;

export type MemeResponse = { meme: Meme };
export type MemeListResponse = { memes: Meme[]; nextCursor: string | null };
export type DashboardMemesResponse = {
  memes: Meme[];
  total: number;
  page: number;
  pageSize: number;
};
export type TagListResponse = { tags: Tag[] };
export type AdminUser = typeof users.$inferSelect;
export type AdminUsersResponse = { users: AdminUser[] };
export type AdminUserResponse = { user: AdminUser };
export type UploadUrlResponse = { uploadUrl: string; key: string; imageUrl: string };
export type ErrorResponse = { error: string };
export type RedirectResponse = { redirect: string };

export type ApiResponse<T> = T | ErrorResponse | RedirectResponse;

// --- Response helpers ---

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<T>(data, { status });
}

export function apiError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}
