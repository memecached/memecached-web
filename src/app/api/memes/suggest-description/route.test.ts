import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthenticatedUser = vi.fn();
const mockSuggestMemeDescription = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

vi.mock("@/lib/ai-description", () => ({
  suggestMemeDescription: (...args: unknown[]) => mockSuggestMemeDescription(...args),
}));

import { POST } from "./route";

function makeRequest(formData: FormData) {
  return {
    formData: async () => formData,
  } as NextRequest;
}

function makeFile(name: string, sizeBytes: number, type: string) {
  return new File([new ArrayBuffer(sizeBytes)], name, { type });
}

function authSuccess() {
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: { id: "user-uuid" },
    error: null,
  });
}

function authFailure(status: number, message: string) {
  mockGetAuthenticatedUser.mockResolvedValue({
    dbUser: null,
    error: NextResponse.json({ error: message }, { status }),
  });
}

describe("POST /api/memes/suggest-description", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    authFailure(401, "Unauthorized");
    const formData = new FormData();
    formData.append("image", makeFile("meme.png", 1024, "image/png"));

    const res = await POST(makeRequest(formData));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockSuggestMemeDescription).not.toHaveBeenCalled();
  });

  test("returns 400 when image is missing", async () => {
    authSuccess();

    const res = await POST(makeRequest(new FormData()));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing image file" });
  });

  test("returns 400 for invalid file type", async () => {
    authSuccess();
    const formData = new FormData();
    formData.append("image", makeFile("meme.txt", 1024, "text/plain"));

    const res = await POST(makeRequest(formData));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid file type. Use PNG, JPEG, GIF, or WebP" });
  });

  test("returns 400 when file exceeds size limit", async () => {
    authSuccess();
    const formData = new FormData();
    formData.append("image", makeFile("meme.png", 2 * 1024 * 1024 + 1, "image/png"));

    const res = await POST(makeRequest(formData));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "File exceeds 2 MB limit" });
  });

  test("returns suggested description for a valid image", async () => {
    authSuccess();
    mockSuggestMemeDescription.mockResolvedValue("A cat looks shocked at a laptop screen.");
    const formData = new FormData();
    formData.append("image", makeFile("meme.png", 1024, "image/png"));

    const res = await POST(makeRequest(formData));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: "A cat looks shocked at a laptop screen.",
    });
    expect(mockSuggestMemeDescription).toHaveBeenCalledWith(expect.any(File));
  });

  test("returns 502 when AI suggestion fails", async () => {
    authSuccess();
    mockSuggestMemeDescription.mockRejectedValue(new Error("OpenAI failed"));
    const formData = new FormData();
    formData.append("image", makeFile("meme.png", 1024, "image/png"));

    const res = await POST(makeRequest(formData));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Failed to suggest description" });
  });
});
