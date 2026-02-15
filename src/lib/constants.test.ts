import { describe, test, expect } from "vitest";
import {
  buildS3Key,
  buildCloudFrontUrl,
  MAX_FILE_SIZE,
  PRESIGNED_URL_EXPIRY_SECONDS,
  ALLOWED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
} from "./constants";

describe("buildS3Key", () => {
  test("formats key as userId/fileId.extension", () => {
    expect(buildS3Key("user-123", "abc-def", "png")).toBe("user-123/abc-def.png");
  });

  test("handles different extensions", () => {
    expect(buildS3Key("u1", "id1", "jpeg")).toBe("u1/id1.jpeg");
    expect(buildS3Key("u1", "id1", "webp")).toBe("u1/id1.webp");
    expect(buildS3Key("u1", "id1", "gif")).toBe("u1/id1.gif");
  });
});

describe("buildS3Key - edge cases", () => {
  test("does not sanitize special characters in userId", () => {
    const key = buildS3Key("user/../../etc", "file-id", "png");
    expect(key).toBe("user/../../etc/file-id.png");
  });

  test("handles empty extension", () => {
    expect(buildS3Key("user", "id", "")).toBe("user/id.");
  });
});

describe("buildCloudFrontUrl", () => {
  test("constructs URL from CLOUDFRONT_DOMAIN and key", () => {
    process.env.CLOUDFRONT_DOMAIN = "cdn.example.com";

    expect(buildCloudFrontUrl("user-123/abc.png")).toBe("https://cdn.example.com/user-123/abc.png");
  });
});

describe("constants", () => {
  test("MAX_FILE_SIZE is 2 MB", () => {
    expect(MAX_FILE_SIZE).toBe(2 * 1024 * 1024);
  });

  test("PRESIGNED_URL_EXPIRY_SECONDS is 5 minutes", () => {
    expect(PRESIGNED_URL_EXPIRY_SECONDS).toBe(300);
  });
});

describe("ALLOWED_EXTENSIONS", () => {
  test("includes supported image extensions", () => {
    for (const ext of ["png", "jpeg", "jpg", "gif", "webp"]) {
      expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  test("rejects non-image extensions", () => {
    for (const ext of ["svg", "bmp", "tiff", "pdf", "exe", "html", ""]) {
      expect(ALLOWED_EXTENSIONS.has(ext)).toBe(false);
    }
  });
});

describe("ACCEPTED_MIME_TYPES", () => {
  test("does not include non-image MIME types", () => {
    expect(ACCEPTED_MIME_TYPES).not.toHaveProperty("application/pdf");
    expect(ACCEPTED_MIME_TYPES).not.toHaveProperty("image/svg+xml");
    expect(ACCEPTED_MIME_TYPES).not.toHaveProperty("text/html");
  });
});
