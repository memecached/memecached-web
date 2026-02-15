import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedUploadUrl } from "@/lib/s3";
import { ALLOWED_EXTENSIONS, buildCloudFrontUrl } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Missing filename query parameter" }, { status: 400 });
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
      { status: 400 },
    );
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, user.email!),
    columns: { id: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { uploadUrl, key } = await getPresignedUploadUrl(dbUser.id, extension);
  const imageUrl = buildCloudFrontUrl(key);

  return NextResponse.json({ uploadUrl, key, imageUrl });
}
