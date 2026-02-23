import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getAdminUser } from "@/lib/auth";
import { apiSuccess, type AdminUsersResponse } from "@/lib/validations";

export async function GET() {
  const { error } = await getAdminUser();
  if (error) return error;

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  return apiSuccess<AdminUsersResponse>({ users: allUsers });
}
