import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockSelect = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}));

vi.mock("@/db/schema", () => ({
  memes: {
    id: "id",
    userId: "user_id",
  },
  tags: { id: "id", name: "name" },
  memeTags: { memeId: "meme_id", tagId: "tag_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ _op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
}));

import { POST } from "./route";

const UUID1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const UUID2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

function makeRequest(body?: unknown) {
  if (body !== undefined) {
    return new NextRequest("http://localhost:3000/api/memes/bulk-tag", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest("http://localhost:3000/api/memes/bulk-tag", {
    method: "POST",
  });
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

describe("POST /api/memes/bulk-tag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");

    const res = await POST(makeRequest({ ids: [UUID1], tags: ["funny"] }));

    expect(res.status).toBe(401);
  });

  test("returns 400 when ids is missing", async () => {
    authSuccess();

    const res = await POST(makeRequest({ tags: ["funny"] }));

    expect(res.status).toBe(400);
  });

  test("returns 400 when ids is empty", async () => {
    authSuccess();

    const res = await POST(makeRequest({ ids: [], tags: ["funny"] }));

    expect(res.status).toBe(400);
  });

  test("returns 400 when tags is missing", async () => {
    authSuccess();

    const res = await POST(makeRequest({ ids: [UUID1] }));

    expect(res.status).toBe(400);
  });

  test("returns 400 when tags is empty", async () => {
    authSuccess();

    const res = await POST(makeRequest({ ids: [UUID1], tags: [] }));

    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON", async () => {
    authSuccess();

    const req = new NextRequest("http://localhost:3000/api/memes/bulk-tag", {
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
    const mockWhere = vi.fn().mockResolvedValue([{ id: UUID1 }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const res = await POST(makeRequest({ ids: [UUID1, UUID2], tags: ["funny"] }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not found or not owned/);
  });

  test("returns 204 on success with merge behavior", async () => {
    authSuccess();

    // User owns both memes
    const mockWhere = vi.fn().mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    mockTransaction.mockImplementation(async () => {
      // Transaction completes successfully
    });

    const res = await POST(makeRequest({ ids: [UUID1, UUID2], tags: ["funny", "cats"] }));

    expect(res.status).toBe(204);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
