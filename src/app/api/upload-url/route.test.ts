import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFindFirst = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  users: { email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
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

describe("GET /api/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await GET(makeRequest("?filename=test.png"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 400 when filename is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });

    const res = await GET(makeRequest(""));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing filename query parameter",
    });
  });

  test("returns 400 for invalid extension", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });

    const res = await GET(makeRequest("?filename=test.exe"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid file type/);
  });

  test("returns 404 when user not found in database", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue(undefined);

    const res = await GET(makeRequest("?filename=test.png"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "User not found" });
  });

  test("returns presigned URL for valid request", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid" });
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
      mockGetUser.mockResolvedValue({
        data: { user: { email: "a@b.com" } },
        error: null,
      });
      mockFindFirst.mockResolvedValue({ id: "user-uuid" });
      mockGetPresignedUploadUrl.mockResolvedValue({
        uploadUrl: "https://s3.amazonaws.com/signed",
        key: `user-uuid/abc.${ext}`,
      });

      const res = await GET(makeRequest(`?filename=test.${ext}`));

      expect(res.status).toBe(200);
    },
  );

  test("handles uppercase extensions", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid" });
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: "https://s3.amazonaws.com/signed",
      key: "user-uuid/abc.png",
    });

    const res = await GET(makeRequest("?filename=test.PNG"));

    expect(res.status).toBe(200);
  });
});
