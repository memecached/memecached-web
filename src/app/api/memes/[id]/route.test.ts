import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockFindFirst = vi.fn();
const mockTransaction = vi.fn();
const mockDelete = vi.fn();
const mockDeleteS3Object = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      memes: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  memes: {
    id: "id",
    userId: "user_id",
    imageUrl: "image_url",
    description: "description",
    createdAt: "created_at",
  },
  tags: { id: "id", name: "name" },
  memeTags: { memeId: "meme_id", tagId: "tag_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
}));

vi.mock("@/lib/s3", () => ({
  deleteS3Object: (...args: unknown[]) => mockDeleteS3Object(...args),
}));

vi.stubEnv("CLOUDFRONT_DOMAIN", "d123.cloudfront.net");

import { PATCH, DELETE } from "./route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function authSuccess(id = "user-uuid") {
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: { id },
    error: null,
  });
}

function authFailure(status: number, message: string) {
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: null,
    error: NextResponse.json({ error: message }, { status }),
  });
}

describe("PATCH /api/memes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "PATCH",
      body: JSON.stringify({ description: "updated" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, makeParams("m1"));

    expect(res.status).toBe(401);
  });

  test("returns 404 when meme not found or not owned", async () => {
    authSuccess();
    mockFindFirst.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "PATCH",
      body: JSON.stringify({ description: "updated" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, makeParams("m1"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Meme not found");
  });

  test("returns 200 with updated meme on success", async () => {
    authSuccess();
    mockFindFirst.mockResolvedValue({
      id: "m1",
      userId: "user-uuid",
      imageUrl: "https://cdn/1.png",
      description: "original",
      createdAt: new Date("2024-01-01"),
    });

    const updatedResult = {
      id: "m1",
      imageUrl: "https://cdn/1.png",
      description: "updated",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      tags: ["funny"],
    };
    mockTransaction.mockImplementation(async () => updatedResult);

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "PATCH",
      body: JSON.stringify({ description: "updated", tags: ["funny"] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, makeParams("m1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meme.description).toBe("updated");
    expect(body.meme.tags).toEqual(["funny"]);
  });

  test("returns 400 for invalid JSON body", async () => {
    authSuccess();
    mockFindFirst.mockResolvedValue({
      id: "m1",
      userId: "user-uuid",
      imageUrl: "https://cdn/1.png",
      description: "original",
      createdAt: new Date("2024-01-01"),
    });

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, makeParams("m1"));

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/memes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "DELETE",
    });

    const res = await DELETE(req, makeParams("m1"));

    expect(res.status).toBe(401);
  });

  test("returns 404 when meme not found or not owned", async () => {
    authSuccess();
    mockFindFirst.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "DELETE",
    });

    const res = await DELETE(req, makeParams("m1"));

    expect(res.status).toBe(404);
  });

  test("returns 204 and deletes from DB and S3 on success", async () => {
    authSuccess();
    mockFindFirst.mockResolvedValue({
      id: "m1",
      userId: "user-uuid",
      imageUrl: "https://d123.cloudfront.net/user-uuid/file.png",
      description: "test",
      createdAt: new Date("2024-01-01"),
    });
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockWhere });
    mockDeleteS3Object.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost:3000/api/memes/m1", {
      method: "DELETE",
    });

    const res = await DELETE(req, makeParams("m1"));

    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteS3Object).toHaveBeenCalledWith("user-uuid/file.png");
  });
});
