export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export const PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

export const DEFAULT_PAGE_LIMIT = 20;

export const MAX_PAGE_LIMIT = 50;

export const SUCCESS_DISPLAY_MS: number = 2000;

export const ALLOWED_EXTENSIONS = new Set(["png", "jpeg", "jpg", "gif", "webp"]);

export const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpeg", ".jpg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};

export function buildS3Key(userId: string, fileId: string, extension: string): string {
  return `${userId}/${fileId}.${extension}`;
}

export function buildCloudFrontUrl(key: string): string {
  return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
}

export function extractS3KeyFromUrl(imageUrl: string): string {
  const prefix = `https://${process.env.CLOUDFRONT_DOMAIN}/`;
  return imageUrl.slice(prefix.length);
}
