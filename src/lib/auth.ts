import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { type TUser, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticatedUser(): Promise<
  { dbUser: TUser; error: null } | { dbUser: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      dbUser: null,
      error: NextResponse.json({ redirect: "/login" }, { status: 401 }),
    };
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, user.email!),
  });

  if (!dbUser) {
    return {
      dbUser: null,
      error: NextResponse.json({ redirect: "/login" }, { status: 401 }),
    };
  }

  if (dbUser.status !== "approved") {
    return {
      dbUser: null,
      error: NextResponse.json({ redirect: `/pending?status=${dbUser.status}` }, { status: 403 }),
    };
  }

  return { dbUser, error: null };
}

export async function getAdminUser(): Promise<{ dbUser: TUser; error: null } | { dbUser: null; error: NextResponse }> {
  const result = await getAuthenticatedUser();
  if (result.error) return result;

  if (result.dbUser.role !== "admin") {
    return {
      dbUser: null,
      error: NextResponse.json({ redirect: "/" }, { status: 403 }),
    };
  }

  return result;
}
