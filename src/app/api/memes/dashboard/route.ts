import { NextRequest } from "next/server";
import { db } from "@/db";
import { memes, tags, memeTags } from "@/db/schema";
import { and, asc, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { dashboardMemesQuerySchema, apiSuccess, apiError, type DashboardMemesResponse } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = dashboardMemesQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const { page, pageSize, q, tag, sortBy, sortOrder } = parsed.data;

  const conditions = [eq(memes.userId, dbUser.id)];

  if (q) {
    conditions.push(ilike(memes.description, `%${q}%`));
  }

  if (tag) {
    const memeIdsWithGivenTagQuery = db
      .select({ memeId: memeTags.memeId })
      .from(memeTags)
      .innerJoin(tags, eq(memeTags.tagId, tags.id))
      .where(eq(tags.name, tag.toLowerCase()));

    conditions.push(inArray(memes.id, memeIdsWithGivenTagQuery));
  }

  const whereClause = and(...conditions);

  // Count total
  const [{ total }] = await db.select({ total: count() }).from(memes).where(whereClause);

  // Determine sort column and direction
  const sortColumn = sortBy === "description" ? memes.description : memes.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  // Paginated query
  const rows = await db
    .select()
    .from(memes)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Fetch tags for returned memes
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
    userId: m.userId,
    imageUrl: m.imageUrl,
    imageWidth: m.imageWidth,
    imageHeight: m.imageHeight,
    description: m.description,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    tags: (tagMap[m.id] || []).sort(),
  }));

  return apiSuccess<DashboardMemesResponse>({
    memes: memesWithTags,
    total,
    page,
    pageSize,
  });
}
