import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/auth";
import { updateUserSchema, apiSuccess, apiError, type AdminUserResponse } from "@/lib/validations";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAdminUser();
  if (error) return error;

  const { id } = await params;

  if (dbUser.id === id) {
    return apiError("Cannot modify your own account", 400);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = updateUserSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400);
  }

  const updates = parsed.data;
  if (!updates.status && !updates.role) {
    return apiError("No fields to update", 400);
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();

  if (!updated) {
    return apiError("User not found", 404);
  }

  return apiSuccess<AdminUserResponse>({ user: updated });
}
