import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/lib/s3", () => ({
  getPresignedUploadUrl: (...args: unknown[]) =>
    mockGetPresignedUploadUrl(...args),
}));

vi.stubEnv("CLOUDFRONT_DOMAIN", "d123.cloudfront.net");

import { GET } from "./route";

function makeRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/upload-url${query}`);
}

function authSuccess(id = "user-uuid") {
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: { id },
    error: null,
  });
}

function authFailure(status: number, message: string) {
  const { NextResponse } = require("next/server");
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: null,
    error: NextResponse.json({ error: message }, { status }),
  });
}

describe("GET /api/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await GET(makeRequest("?filename=test.png"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 400 when filename is missing", async () => {
    authSuccess();

    const res = await GET(makeRequest(""));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing filename query parameter",
    });
  });

  test("returns 400 for invalid extension", async () => {
    authSuccess();

    const res = await GET(makeRequest("?filename=test.exe"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid file type/);
  });

  test("returns 404 when user not found in database", async () => {
    authFailure(404, "User not found");

    const res = await GET(makeRequest("?filename=test.png"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "User not found" });
  });

  test("returns presigned URL for valid request", async () => {
    authSuccess();
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: "https://s3.amazonaws.com/signed",
      key: "user-uuid/abc.png",
    });

    const res = await GET(makeRequest("?filename=meme.png"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      uploadUrl: "https://s3.amazonaws.com/signed",
      key: "user-uuid/abc.png",
      imageUrl: "https://d123.cloudfront.net/user-uuid/abc.png",
    });
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith("user-uuid", "png");
  });

  test.each(["png", "jpeg", "jpg", "gif", "webp"])(
    "accepts .%s extension",
    async (ext) => {
      authSuccess();
      mockGetPresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://s3.amazonaws.com/signed",
        key: `user-uuid/abc.${ext}`,
      });

      const res = await GET(makeRequest(`?filename=test.${ext}`));

      expect(res.status).toBe(200);
    },
  );

  test("handles uppercase extensions", async () => {
    authSuccess();
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: "https://s3.amazonaws.com/signed",
      key: "user-uuid/abc.png",
    });

    const res = await GET(makeRequest("?filename=test.PNG"));

    expect(res.status).toBe(200);
  });
});
