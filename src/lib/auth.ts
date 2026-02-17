import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getAuthenticatedUser(): Promise<
  | { dbUser: { id: string }; error: null }
  | { dbUser: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      dbUser: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, user.email!),
    columns: { id: true },
  });

  if (!dbUser) {
    return {
      dbUser: null,
      error: NextResponse.json({ error: "User not found" }, { status: 404 }),
    };
  }

  return { dbUser, error: null };
}
