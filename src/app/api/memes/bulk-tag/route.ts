import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memes, tags, memeTags } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { bulkTagSchema, apiError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = bulkTagSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { ids, tags: tagNames } = parsed.data;

  // Verify all memes belong to user
  const userMemes = await db
    .select({ id: memes.id })
    .from(memes)
    .where(and(inArray(memes.id, ids), eq(memes.userId, dbUser.id)));

  if (userMemes.length !== ids.length) {
    return apiError("Some memes not found or not owned by user", 403);
  }

  await db.transaction(async (tx) => {
    // Upsert tags
    await tx
      .insert(tags)
      .values(tagNames.map((name) => ({ name: name.toLowerCase() })))
      .onConflictDoNothing({ target: tags.name });

    // Fetch tag rows
    const resolvedTags = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(
        inArray(
          tags.name,
          tagNames.map((n) => n.toLowerCase()),
        ),
      );

    // Insert junction rows for all meme+tag combinations (merge, not replace)
    const junctionRows = ids.flatMap((memeId) =>
      resolvedTags.map((t) => ({ memeId, tagId: t.id })),
    );

    await tx
      .insert(memeTags)
      .values(junctionRows)
      .onConflictDoNothing();
  });

  return new NextResponse(null, { status: 204 });
}
