import { describe, test, expect, vi, beforeEach } from "vitest";

// Set env vars and create mock before module evaluation via vi.hoisted
const mockSend = vi.hoisted(() => {
  process.env.AWS_REGION = "us-west-2";
  process.env.AWS_ACCESS_KEY_ID = "test-key";
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
  process.env.S3_BUCKET_NAME = "test-bucket";
  return vi.fn();
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn((input: unknown) => ({ _input: input, _type: "DeleteObject" })),
  DeleteObjectsCommand: vi.fn((input: unknown) => ({ _input: input, _type: "DeleteObjects" })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.amazonaws.com/signed-url"),
}));

import { getPresignedUploadUrl, deleteS3Object, deleteS3Objects } from "./s3";
import { PRESIGNED_URL_EXPIRY_SECONDS } from "./constants";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

describe("getPresignedUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the signed URL", async () => {
    const { uploadUrl } = await getPresignedUploadUrl("user-123", "jpg");

    expect(uploadUrl).toBe("https://s3.amazonaws.com/signed-url");
  });

  test("returns a key matching userId/uuid.extension format", async () => {
    const { key } = await getPresignedUploadUrl("user-123", "png");

    expect(key).toMatch(/^user-123\/[0-9a-f-]+\.png$/);
  });

  test("passes expiry to getSignedUrl", async () => {
    await getPresignedUploadUrl("user-123", "gif");

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: PRESIGNED_URL_EXPIRY_SECONDS }),
    );
  });

  test("generates unique keys for each call", async () => {
    const { key: key1 } = await getPresignedUploadUrl("user-123", "png");
    const { key: key2 } = await getPresignedUploadUrl("user-123", "png");

    expect(key1).not.toBe(key2);
  });

  test("propagates error when getSignedUrl fails", async () => {
    vi.mocked(getSignedUrl).mockRejectedValueOnce(new Error("AWS credentials expired"));

    await expect(getPresignedUploadUrl("user-123", "png")).rejects.toThrow(
      "AWS credentials expired",
    );
  });

  test("creates PutObjectCommand with correct bucket and key", async () => {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");

    await getPresignedUploadUrl("user-456", "webp");

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "test-bucket",
        Key: expect.stringMatching(/^user-456\/[0-9a-f-]+\.webp$/),
      }),
    );
  });
});

describe("deleteS3Object", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends DeleteObjectCommand with correct bucket and key", async () => {
    mockSend.mockResolvedValue({});

    await deleteS3Object("user-id/file.png");

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "user-id/file.png",
    });
    expect(mockSend).toHaveBeenCalledOnce();
  });
});

describe("deleteS3Objects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends DeleteObjectsCommand with correct bucket and keys", async () => {
    mockSend.mockResolvedValue({});

    await deleteS3Objects(["key1.png", "key2.jpg"]);

    expect(DeleteObjectsCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Delete: {
        Objects: [{ Key: "key1.png" }, { Key: "key2.jpg" }],
      },
    });
    expect(mockSend).toHaveBeenCalledOnce();
  });

  test("does nothing when keys array is empty", async () => {
    await deleteS3Objects([]);

    expect(mockSend).not.toHaveBeenCalled();
  });
});
