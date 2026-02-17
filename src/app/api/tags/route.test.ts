import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

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
  tags: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  asc: vi.fn((col) => ({ _op: "asc", col })),
}));

import { GET } from "./route";

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

describe("GET /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await GET();

    expect(res.status).toBe(401);
  });

  test("returns tags ordered alphabetically", async () => {
    authSuccess();

    const tagList = [
      { id: "t1", name: "animals" },
      { id: "t2", name: "funny" },
      { id: "t3", name: "reaction" },
    ];

    const mockOrderBy = vi.fn().mockResolvedValue(tagList);
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    mockSelect.mockReturnValue({ from: mockFrom });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toEqual(tagList);
  });

  test("returns empty array when no tags exist", async () => {
    authSuccess();

    const mockOrderBy = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    mockSelect.mockReturnValue({ from: mockFrom });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags).toEqual([]);
  });
});
