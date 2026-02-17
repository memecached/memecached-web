import { NextRequest } from "next/server";
import { getPresignedUploadUrl } from "@/lib/s3";
import { ALLOWED_EXTENSIONS, buildCloudFrontUrl } from "@/lib/constants";
import { getAuthenticatedUser } from "@/lib/auth";
import { apiSuccess, apiError, type UploadUrlResponse } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const { dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename) {
    return apiError("Missing filename query parameter", 400);
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return apiError(`Invalid file type. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`, 400);
  }

  const { uploadUrl, key } = await getPresignedUploadUrl(dbUser.id, extension);
  const imageUrl = buildCloudFrontUrl(key);

  return apiSuccess<UploadUrlResponse>({ uploadUrl, key, imageUrl });
}
