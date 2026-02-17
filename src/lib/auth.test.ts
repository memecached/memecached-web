import { describe, test, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFindFirst = vi.fn();

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

import { getAuthenticatedUser } from "./auth";

describe("getAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 error when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error).not.toBeNull();
    const body = await result.error!.json();
    expect(result.error!.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 error when auth has error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("bad token"),
    });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(401);
  });

  test("returns 404 error when user not found in DB", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue(undefined);

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(404);
    const body = await result.error!.json();
    expect(body).toEqual({ error: "User not found" });
  });

  test("returns dbUser when authenticated and found in DB", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid" });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toEqual({ id: "user-uuid" });
    expect(result.error).toBeNull();
  });
});
