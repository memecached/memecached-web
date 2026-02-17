import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { deleteS3Objects } from "@/lib/s3";
import { extractS3KeyFromUrl } from "@/lib/constants";
import { bulkDeleteSchema, apiError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = bulkDeleteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { ids } = parsed.data;

  // Fetch all memes that belong to this user
  const userMemes = await db
    .select({ id: memes.id, imageUrl: memes.imageUrl })
    .from(memes)
    .where(and(inArray(memes.id, ids), eq(memes.userId, dbUser.id)));

  if (userMemes.length !== ids.length) {
    return apiError("Some memes not found or not owned by user", 403);
  }

  const s3Keys = userMemes.map((m) => extractS3KeyFromUrl(m.imageUrl));

  // Delete from DB first (cascade deletes meme_tags)
  await db
    .delete(memes)
    .where(and(inArray(memes.id, ids), eq(memes.userId, dbUser.id)));

  // Then batch-delete from S3
  await deleteS3Objects(s3Keys);

  return new NextResponse(null, { status: 204 });
}
