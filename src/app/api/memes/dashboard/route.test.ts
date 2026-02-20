import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/db", () => ({
  db: {
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
    updatedAt: "updated_at",
  },
  tags: { id: "id", name: "name" },
  memeTags: { memeId: "meme_id", tagId: "tag_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  desc: vi.fn((col) => ({ _op: "desc", col })),
  asc: vi.fn((col) => ({ _op: "asc", col })),
  count: vi.fn(() => "count(*)"),
  ilike: vi.fn((col, val) => ({ _op: "ilike", col, val })),
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
}));

import { GET } from "./route";

function makeRequest(url: string) {
  return new NextRequest(`http://localhost:3000${url}`, { method: "GET" });
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

function setupMocks(memeRows: unknown[], tagRows: unknown[] = [], total = memeRows.length) {
  let callIndex = 0;

  const mockOffset = vi.fn().mockResolvedValue(memeRows);
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });

  mockSelect.mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) {
      // COUNT query: select({total}).from(memes).where(...)
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total }]),
        }),
      };
    } else if (callIndex === 2) {
      // Paginated data query: select().from(memes).where(...).orderBy(...).limit(...).offset(...)
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ orderBy: mockOrderBy }),
        }),
      };
    } else {
      // Tag query: select({...}).from(memeTags).innerJoin(...).where(...)
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(tagRows),
          }),
        }),
      };
    }
  });

  return { mockOffset, mockLimit, mockOrderBy };
}

describe("GET /api/memes/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await GET(makeRequest("/api/memes/dashboard"));

    expect(res.status).toBe(401);
  });

  test("returns paginated results with total", async () => {
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

    setupMocks(memeRows, [{ memeId: "m1", tagName: "funny" }], 25);

    const res = await GET(makeRequest("/api/memes/dashboard"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(25);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.memes).toHaveLength(1);
    expect(body.memes[0].tags).toEqual(["funny"]);
  });

  test("respects sort params", async () => {
    authSuccess();
    const { mockOrderBy } = setupMocks([], [], 0);

    const res = await GET(makeRequest("/api/memes/dashboard?sortBy=description&sortOrder=asc"));

    expect(res.status).toBe(200);
    expect(mockOrderBy).toHaveBeenCalled();
  });

  test("respects page param", async () => {
    authSuccess();
    const { mockOffset } = setupMocks([], [], 0);

    const res = await GET(makeRequest("/api/memes/dashboard?page=3&pageSize=10"));

    expect(res.status).toBe(200);
    // offset = (3-1) * 10 = 20
    expect(mockOffset).toHaveBeenCalledWith(20);
  });

  test("applies search filter", async () => {
    authSuccess();
    setupMocks([], [], 0);

    const res = await GET(makeRequest("/api/memes/dashboard?q=funny"));

    expect(res.status).toBe(200);
  });

  test("applies tag filter", async () => {
    authSuccess();

    // Tag filter causes an extra db.select() call for the subquery
    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // Tag subquery: select({memeId}).from(memeTags).innerJoin(...).where(...)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue("tag-subquery"),
            }),
          }),
        };
      } else if (callIndex === 2) {
        // COUNT query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        };
      } else if (callIndex === 3) {
        // Paginated data query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };
      } else {
        // Tag fetch query (skipped when no results)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }
    });

    const res = await GET(makeRequest("/api/memes/dashboard?tag=cats"));

    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid sortBy", async () => {
    authSuccess();

    const res = await GET(makeRequest("/api/memes/dashboard?sortBy=invalid"));

    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid sortOrder", async () => {
    authSuccess();

    const res = await GET(makeRequest("/api/memes/dashboard?sortOrder=invalid"));

    expect(res.status).toBe(400);
  });

  test("returns 400 when page is 0", async () => {
    authSuccess();

    const res = await GET(makeRequest("/api/memes/dashboard?page=0"));

    expect(res.status).toBe(400);
  });

  test("returns empty memes array when no results", async () => {
    authSuccess();
    setupMocks([], [], 0);

    const res = await GET(makeRequest("/api/memes/dashboard"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memes).toEqual([]);
    expect(body.total).toBe(0);
  });
});
