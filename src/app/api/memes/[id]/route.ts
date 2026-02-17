import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memes, tags, memeTags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { deleteS3Object } from "@/lib/s3";
import { extractS3KeyFromUrl } from "@/lib/constants";
import { updateMemeSchema, apiSuccess, apiError, type MemeResponse } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;

  const existing = await db.query.memes.findFirst({
    where: and(eq(memes.id, id), eq(memes.userId, dbUser.id)),
  });

  if (!existing) {
    return apiError("Meme not found", 404);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = updateMemeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { description, tags: tagNames } = parsed.data;

  const result = await db.transaction(async (tx) => {
    let updatedMeme = existing;

    if (description !== undefined) {
      const [updated] = await tx
        .update(memes)
        .set({ description })
        .where(eq(memes.id, id))
        .returning();
      updatedMeme = updated;
    }

    let resolvedTags: { id: string; name: string }[] = [];

    if (tagNames !== undefined) {
      // Delete existing meme_tags
      await tx.delete(memeTags).where(eq(memeTags.memeId, id));

      if (tagNames.length > 0) {
        // Upsert tags
        await tx
          .insert(tags)
          .values(tagNames.map((name) => ({ name: name.toLowerCase() })))
          .onConflictDoNothing({ target: tags.name });

        // Fetch tag rows
        resolvedTags = await tx
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(
            inArray(
              tags.name,
              tagNames.map((n) => n.toLowerCase()),
            ),
          );

        // Insert new junction rows
        await tx
          .insert(memeTags)
          .values(
            resolvedTags.map((t) => ({ memeId: id, tagId: t.id })),
          );
      }
    } else {
      // Fetch existing tags
      const existingTags = await tx
        .select({ id: tags.id, name: tags.name })
        .from(memeTags)
        .innerJoin(tags, eq(memeTags.tagId, tags.id))
        .where(eq(memeTags.memeId, id));
      resolvedTags = existingTags;
    }

    return {
      id: updatedMeme.id,
      userId: updatedMeme.userId,
      imageUrl: updatedMeme.imageUrl,
      description: updatedMeme.description,
      createdAt: updatedMeme.createdAt,
      updatedAt: updatedMeme.updatedAt,
      tags: resolvedTags.map((t) => t.name),
    };
  });

  return apiSuccess<MemeResponse>({ meme: result });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await params;

  const existing = await db.query.memes.findFirst({
    where: and(eq(memes.id, id), eq(memes.userId, dbUser.id)),
  });

  if (!existing) {
    return apiError("Meme not found", 404);
  }

  const s3Key = extractS3KeyFromUrl(existing.imageUrl);

  // Delete from DB first (cascade deletes meme_tags)
  await db.delete(memes).where(eq(memes.id, id));

  // Then delete from S3
  await deleteS3Object(s3Key);

  return new NextResponse(null, { status: 204 });
}
