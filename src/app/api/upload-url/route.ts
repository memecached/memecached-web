import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/s3";
import { ALLOWED_EXTENSIONS, buildCloudFrontUrl } from "@/lib/constants";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

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

  const { uploadUrl, key } = await getPresignedUploadUrl(dbUser.id, extension);
  const imageUrl = buildCloudFrontUrl(key);

  return NextResponse.json({ uploadUrl, key, imageUrl });
}
