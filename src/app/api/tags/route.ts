import { db } from "@/db";
import { tags } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { apiSuccess, type TagListResponse } from "@/lib/validations";

export async function GET() {
  const { error } = await getAuthenticatedUser();
  if (error) return error;

  const allTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));

  return apiSuccess<TagListResponse>({ tags: allTags });
}
