import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
    select: (...args: unknown[]) => mockSelect(...args),
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
  desc: vi.fn((col) => ({ _op: "desc", col })),
  lt: vi.fn((col, val) => ({ _op: "lt", col, val })),
  ilike: vi.fn((col, val) => ({ _op: "ilike", col, val })),
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
  sql: vi.fn(),
}));

import { POST, GET } from "./route";

function makeRequest(method: string, url: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(`http://localhost:3000${url}`, init);
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

describe("POST /api/memes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await POST(
      makeRequest("POST", "/api/memes", {
        imageUrl: "https://cdn/img.png",
        description: "test",
      }),
    );

    expect(res.status).toBe(401);
  });

  test("returns 400 when imageUrl is missing", async () => {
    authSuccess();

    const res = await POST(
      makeRequest("POST", "/api/memes", { description: "test" }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/imageUrl and description are required/);
  });

  test("returns 400 when description is missing", async () => {
    authSuccess();

    const res = await POST(
      makeRequest("POST", "/api/memes", { imageUrl: "https://cdn/img.png" }),
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON body", async () => {
    authSuccess();

    const req = new NextRequest("http://localhost:3000/api/memes", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  test("returns 201 with meme on success", async () => {
    authSuccess();

    const createdMeme = {
      id: "meme-1",
      imageUrl: "https://cdn/img.png",
      description: "funny meme",
      createdAt: new Date("2024-01-01"),
      tags: ["funny", "cat"],
    };

    mockTransaction.mockImplementation(async (fn) => {
      return createdMeme;
    });

    const res = await POST(
      makeRequest("POST", "/api/memes", {
        imageUrl: "https://cdn/img.png",
        description: "funny meme",
        tags: ["funny", "cat"],
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.meme).toEqual({
      id: "meme-1",
      imageUrl: "https://cdn/img.png",
      description: "funny meme",
      createdAt: "2024-01-01T00:00:00.000Z",
      tags: ["funny", "cat"],
    });
  });

  test("returns 201 without tags", async () => {
    authSuccess();

    const createdMeme = {
      id: "meme-2",
      imageUrl: "https://cdn/img.png",
      description: "no tags",
      createdAt: new Date("2024-01-01"),
      tags: [],
    };

    mockTransaction.mockImplementation(async () => createdMeme);

    const res = await POST(
      makeRequest("POST", "/api/memes", {
        imageUrl: "https://cdn/img.png",
        description: "no tags",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.meme.tags).toEqual([]);
  });
});

describe("GET /api/memes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await GET(makeRequest("GET", "/api/memes"));

    expect(res.status).toBe(401);
  });

  test("returns memes with tags and null nextCursor when no more pages", async () => {
    authSuccess();

    const memeRows = [
      {
        id: "m1",
        userId: "user-uuid",
        imageUrl: "https://cdn/1.png",
        description: "meme 1",
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-02"),
      },
    ];

    // Mock the chained select().from().where().orderBy().limit()
    const mockLimit = vi.fn().mockResolvedValue(memeRows);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Mock the tag query (second select call)
    const mockTagLimit = vi.fn();
    const mockTagOrderBy = vi.fn();
    const mockTagWhere = vi.fn().mockResolvedValue([
      { memeId: "m1", tagName: "funny" },
    ]);
    const mockTagInnerJoin = vi.fn().mockReturnValue({ where: mockTagWhere });
    const mockTagFrom = vi.fn().mockReturnValue({ innerJoin: mockTagInnerJoin });

    // On second call, return tag query chain
    mockSelect
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockTagFrom });

    const res = await GET(makeRequest("GET", "/api/memes"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
    expect(body.memes).toHaveLength(1);
    expect(body.memes[0].tags).toEqual(["funny"]);
  });

  test("returns nextCursor when more pages available", async () => {
    authSuccess();

    // Create 21 rows (limit 20 + 1)
    const memeRows = Array.from({ length: 21 }, (_, i) => ({
      id: `m${i}`,
      userId: "user-uuid",
      imageUrl: `https://cdn/${i}.png`,
      description: `meme ${i}`,
      createdAt: new Date(`2024-01-${String(21 - i).padStart(2, "0")}`),
      updatedAt: new Date(`2024-01-${String(21 - i).padStart(2, "0")}`),
    }));

    const mockLimit = vi.fn().mockResolvedValue(memeRows);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

    const mockTagWhere = vi.fn().mockResolvedValue([]);
    const mockTagInnerJoin = vi.fn().mockReturnValue({ where: mockTagWhere });
    const mockTagFrom = vi.fn().mockReturnValue({ innerJoin: mockTagInnerJoin });

    mockSelect
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockTagFrom });

    const res = await GET(makeRequest("GET", "/api/memes"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memes).toHaveLength(20);
    expect(body.nextCursor).not.toBeNull();
  });

  test("respects limit query param with max of 50", async () => {
    authSuccess();

    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    await GET(makeRequest("GET", "/api/memes?limit=100"));

    // Should cap at 50+1 = 51
    expect(mockLimit).toHaveBeenCalledWith(51);
  });
});
