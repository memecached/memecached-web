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

import { getAuthenticatedUser, getAdminUser } from "./auth";

describe("getAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 redirect to /login when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(401);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/login" });
  });

  test("returns 401 redirect to /login when auth has error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("bad token"),
    });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(401);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/login" });
  });

  test("returns 401 redirect to /login when user not found in DB", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue(undefined);

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(401);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/login" });
  });

  test("returns 403 redirect to /pending when status is pending", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid", role: "user", status: "pending" });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(403);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/pending?status=pending" });
  });

  test("returns 403 redirect to /pending when status is rejected", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid", role: "user", status: "rejected" });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(403);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/pending?status=rejected" });
  });

  test("returns dbUser when authenticated and approved", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid", role: "user", status: "approved" });

    const result = await getAuthenticatedUser();

    expect(result.dbUser).toEqual({ id: "user-uuid", role: "user", status: "approved" });
    expect(result.error).toBeNull();
  });
});

describe("getAdminUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 403 redirect to / for non-admin role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "a@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "user-uuid", role: "user", status: "approved" });

    const result = await getAdminUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(403);
    const body = await result.error!.json();
    expect(body).toEqual({ redirect: "/" });
  });

  test("passes through auth errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAdminUser();

    expect(result.dbUser).toBeNull();
    expect(result.error!.status).toBe(401);
  });

  test("returns dbUser for admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "admin@b.com" } },
      error: null,
    });
    mockFindFirst.mockResolvedValue({ id: "admin-uuid", role: "admin", status: "approved" });

    const result = await getAdminUser();

    expect(result.dbUser).toEqual({ id: "admin-uuid", role: "admin", status: "approved" });
    expect(result.error).toBeNull();
  });
});
