import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { suggestMemeDescription } from "@/lib/ai-description";
import { apiError, apiSuccess, type SuggestDescriptionResponse } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const { error } = await getAuthenticatedUser();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Invalid form data", 400);
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return apiError("Missing image file", 400);
  }

  if (!Object.keys(ACCEPTED_MIME_TYPES).includes(image.type)) {
    return apiError("Invalid file type. Use PNG, JPEG, GIF, or WebP", 400);
  }

  if (image.size > MAX_FILE_SIZE) {
    return apiError("File exceeds 2 MB limit", 400);
  }

  try {
    const description = await suggestMemeDescription(image);
    return apiSuccess<SuggestDescriptionResponse>({ description });
  } catch {
    return apiError("Failed to suggest description", 502);
  }
}
