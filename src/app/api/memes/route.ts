import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { memes, tags, memeTags } from "@/db/schema";
import { and, desc, eq, ilike, inArray, lt, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { imageUrl?: string; description?: string; tags?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageUrl, description, tags: tagNames } = body;

  if (!imageUrl || !description) {
    return NextResponse.json(
      { error: "imageUrl and description are required" },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    const [meme] = await tx
      .insert(memes)
      .values({
        userId: dbUser.id,
        imageUrl,
        description,
      })
      .returning();

    let resolvedTags: { id: string; name: string }[] = [];

    if (tagNames && tagNames.length > 0) {
      // Upsert tags (insert if not exists)
      await tx
        .insert(tags)
        .values(tagNames.map((name) => ({ name: name.toLowerCase() })))
        .onConflictDoNothing({ target: tags.name });

      // Fetch the tag rows
      resolvedTags = await tx
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(
          inArray(
            tags.name,
            tagNames.map((n) => n.toLowerCase()),
          ),
        );

      // Insert junction rows
      await tx
        .insert(memeTags)
        .values(resolvedTags.map((t) => ({ memeId: meme.id, tagId: t.id })));
    }

    return {
      id: meme.id,
      imageUrl: meme.imageUrl,
      description: meme.description,
      createdAt: meme.createdAt,
      tags: resolvedTags.map((t) => t.name),
    };
  });

  return NextResponse.json({ meme: result }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor");
  const limit = Math.min(Number(params.get("limit")) || 20, 50);
  const q = params.get("q");
  const tag = params.get("tag");

  const conditions = [eq(memes.userId, dbUser.id)];

  if (cursor) {
    conditions.push(lt(memes.createdAt, new Date(cursor)));
  }

  if (q) {
    conditions.push(ilike(memes.description, `%${q}%`));
  }

  if (tag) {
    // Subquery: meme IDs that have this tag
    const tagSubquery = db
      .select({ memeId: memeTags.memeId })
      .from(memeTags)
      .innerJoin(tags, eq(memeTags.tagId, tags.id))
      .where(eq(tags.name, tag.toLowerCase()));

    conditions.push(inArray(memes.id, tagSubquery));
  }

  const rows = await db
    .select()
    .from(memes)
    .where(and(...conditions))
    .orderBy(desc(memes.createdAt))
    .limit(limit + 1);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    nextCursor = rows[rows.length - 1].createdAt.toISOString();
  }

  // Fetch tags for each meme
  const memeIds = rows.map((m) => m.id);
  let tagMap: Record<string, string[]> = {};

  if (memeIds.length > 0) {
    const tagRows = await db
      .select({
        memeId: memeTags.memeId,
        tagName: tags.name,
      })
      .from(memeTags)
      .innerJoin(tags, eq(memeTags.tagId, tags.id))
      .where(inArray(memeTags.memeId, memeIds));

    tagMap = tagRows.reduce(
      (acc, row) => {
        if (!acc[row.memeId]) acc[row.memeId] = [];
        acc[row.memeId].push(row.tagName);
        return acc;
      },
      {} as Record<string, string[]>,
    );
  }

  const memesWithTags = rows.map((m) => ({
    id: m.id,
    imageUrl: m.imageUrl,
    description: m.description,
    createdAt: m.createdAt,
    tags: tagMap[m.id] || [],
  }));

  return NextResponse.json({ memes: memesWithTags, nextCursor });
}
