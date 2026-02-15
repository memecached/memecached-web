import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockDeleteS3Objects = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  memes: {
    id: "id",
    userId: "user_id",
    imageUrl: "image_url",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
}));

vi.mock("@/lib/s3", () => ({
  deleteS3Objects: (...args: unknown[]) => mockDeleteS3Objects(...args),
}));

vi.stubEnv("CLOUDFRONT_DOMAIN", "d123.cloudfront.net");

import { POST } from "./route";

function makeRequest(body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost:3000/api/memes/bulk-delete", init);
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

describe("POST /api/memes/bulk-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await POST(makeRequest({ ids: ["m1"] }));

    expect(res.status).toBe(401);
  });

  test("returns 400 when ids is missing", async () => {
    authSuccess();

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ids array is required/);
  });

  test("returns 400 when ids is empty", async () => {
    authSuccess();

    const res = await POST(makeRequest({ ids: [] }));

    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    authSuccess();

    const req = new NextRequest("http://localhost:3000/api/memes/bulk-delete", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  test("returns 403 when some memes not owned by user", async () => {
    authSuccess();

    // User owns only 1 of the 2 requested
    const mockWhere = vi.fn().mockResolvedValue([
      { id: "m1", imageUrl: "https://d123.cloudfront.net/u/1.png" },
    ]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest({ ids: ["m1", "m2"] }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not found or not owned/);
  });

  test("returns 204 and deletes from DB and S3 on success", async () => {
    authSuccess();

    const userMemes = [
      { id: "m1", imageUrl: "https://d123.cloudfront.net/u/1.png" },
      { id: "m2", imageUrl: "https://d123.cloudfront.net/u/2.jpg" },
    ];
    const mockSelectWhere = vi.fn().mockResolvedValue(userMemes);
    const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteS3Objects.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ ids: ["m1", "m2"] }));

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteS3Objects).toHaveBeenCalledWith(["u/1.png", "u/2.jpg"]);
  });
});
