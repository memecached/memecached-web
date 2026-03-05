import { describe, test, expect, vi, beforeEach } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}));

vi.mock("@/db/schema", () => ({
  memes: { id: "id", userId: "user_id", imageUrl: "image_url", description: "description", createdAt: "created_at" },
  tags: { id: "id", name: "name" },
  memeTags: { memeId: "meme_id", tagId: "tag_id" },
}));

vi.mock("drizzle-orm", () => ({
  inArray: vi.fn((col, val) => ({ _op: "inArray", col, val })),
}));

vi.mock("fs", () => ({
  default: { readFileSync: vi.fn() },
}));

vi.mock("image-size", () => ({
  imageSize: vi.fn(),
}));

vi.stubEnv("CLOUDFRONT_DOMAIN", "test.cloudfront.net");

import path from "path";
import { main } from "./migrate-db";
import fs from "fs";
import { imageSize } from "image-size";
import { memes as memesTable, memeTags as memeTagsTable } from "@/db/schema";

const USER_ID = "496478f3-784f-4f14-9e1a-2037228199f1";
const CLOUDFRONT_DOMAIN = "test.cloudfront.net";

const TAG_CSV = `id,name\nold-tag-1,Funny\nold-tag-2,Cute`;
const IMAGE_CSV = [
  "id,filename,url,description,createdAt,userId",
  `old-img-1,abc123,https://old.cdn/abc123,hello world,2023-01-01 00:00:00.000,old-user`,
  `old-img-2,def456,https://old.cdn/def456,"meme with, a comma",2023-02-01 00:00:00.000,old-user`,
].join("\n");
const IMAGE_TO_TAG_CSV = `A,B\nold-img-1,old-tag-1\nold-img-2,old-tag-2\nold-img-1,old-tag-2`;

const INSERTED_TAGS = [
  { id: "new-tag-1", name: "funny" },
  { id: "new-tag-2", name: "cute" },
];
const INSERTED_MEMES = [
  { id: "new-meme-1", imageUrl: `https://${CLOUDFRONT_DOMAIN}/${USER_ID}/abc123` },
  { id: "new-meme-2", imageUrl: `https://${CLOUDFRONT_DOMAIN}/${USER_ID}/def456` },
];

function setupFsMock() {
  vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
    const p = path.basename(filePath as string);
    if (p === "Tag.csv") return TAG_CSV;
    if (p === "Image.csv") return IMAGE_CSV;
    if (p === "_ImageToTag.csv") return IMAGE_TO_TAG_CSV;
    throw new Error(`Unexpected file: ${p}`);
  });
}

function buildMockTx(insertedTags = INSERTED_TAGS, insertedMemes = INSERTED_MEMES) {
  // Use explicit mockReturnValue(chain) instead of mockReturnThis() to avoid
  // ambiguous `this` binding when the mock is called outside a method context.
  const tagsInsertChain = { values: vi.fn(), onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
  tagsInsertChain.values.mockReturnValue(tagsInsertChain);

  const tagsSelectChain = { from: vi.fn(), where: vi.fn().mockResolvedValue(insertedTags) };
  tagsSelectChain.from.mockReturnValue(tagsSelectChain);

  const memesInsertChain = { values: vi.fn(), returning: vi.fn().mockResolvedValue(insertedMemes) };
  memesInsertChain.values.mockReturnValue(memesInsertChain);

  const memeTagsInsertChain = { values: vi.fn(), onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
  memeTagsInsertChain.values.mockReturnValue(memeTagsInsertChain);

  // Key on schema table object identity instead of call order to be order-independent.
  const txInsert = vi.fn().mockImplementation((table: unknown) => {
    if (table === memesTable) return memesInsertChain;
    if (table === memeTagsTable) return memeTagsInsertChain;
    return tagsInsertChain;
  });
  const txSelect = vi.fn().mockReturnValue(tagsSelectChain);

  const tx = { insert: txInsert, select: txSelect };
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));

  return { tx, tagsInsertChain, tagsSelectChain, memesInsertChain, memeTagsInsertChain };
}

describe("migrate-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    setupFsMock();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
    );
    vi.mocked(imageSize).mockReturnValue({ width: 800, height: 600, type: "jpg" });
  });

  test("throws when CLOUDFRONT_DOMAIN is not set", async () => {
    vi.stubEnv("CLOUDFRONT_DOMAIN", "");
    await expect(main()).rejects.toThrow("CLOUDFRONT_DOMAIN is not set");
    vi.stubEnv("CLOUDFRONT_DOMAIN", CLOUDFRONT_DOMAIN);
  });

  test("wraps all steps in a transaction", async () => {
    buildMockTx();
    await main();
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  test("inserts tags with lowercased names", async () => {
    const { tagsInsertChain } = buildMockTx();
    await main();
    expect(tagsInsertChain.values).toHaveBeenCalledWith([{ name: "funny" }, { name: "cute" }]);
  });

  test("inserts memes with correct imageUrl using CLOUDFRONT_DOMAIN, USER_ID, and filename", async () => {
    const { memesInsertChain } = buildMockTx();
    await main();
    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as { imageUrl: string }[];
    expect(memeValues[0].imageUrl).toBe(`https://${CLOUDFRONT_DOMAIN}/${USER_ID}/abc123`);
    expect(memeValues[1].imageUrl).toBe(`https://${CLOUDFRONT_DOMAIN}/${USER_ID}/def456`);
  });

  test("preserves createdAt from CSV", async () => {
    const { memesInsertChain } = buildMockTx();
    await main();
    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as { createdAt: Date }[];
    expect(memeValues[0].createdAt).toEqual(new Date("2023-01-01 00:00:00.000"));
    expect(memeValues[1].createdAt).toEqual(new Date("2023-02-01 00:00:00.000"));
  });

  test("sets userId to the migration USER_ID for all memes", async () => {
    const { memesInsertChain } = buildMockTx();
    await main();
    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as { userId: string }[];
    expect(memeValues.every((m) => m.userId === USER_ID)).toBe(true);
  });

  test("handles description containing commas", async () => {
    const { memesInsertChain } = buildMockTx();
    await main();
    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as { description: string }[];
    expect(memeValues[1].description).toBe("meme with, a comma");
  });

  test("inserts meme-tag relations with correctly translated new IDs", async () => {
    const { memeTagsInsertChain } = buildMockTx();
    await main();
    const memeTagValues = vi.mocked(memeTagsInsertChain.values).mock.calls[0][0] as {
      memeId: string;
      tagId: string;
    }[];
    expect(memeTagValues).toContainEqual({ memeId: "new-meme-1", tagId: "new-tag-1" });
    expect(memeTagValues).toContainEqual({ memeId: "new-meme-2", tagId: "new-tag-2" });
    expect(memeTagValues).toContainEqual({ memeId: "new-meme-1", tagId: "new-tag-2" });
  });

  test("skips meme-tag relations with unresolvable image IDs", async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath: unknown) => {
      const p = path.basename(filePath as string);
      if (p === "Tag.csv") return TAG_CSV;
      if (p === "Image.csv") return IMAGE_CSV;
      if (p === "_ImageToTag.csv") return `A,B\nold-img-1,old-tag-1\nunknown-img,old-tag-1`;
      throw new Error(`Unexpected file: ${p}`);
    });

    const { memeTagsInsertChain } = buildMockTx();
    await main();

    const memeTagValues = vi.mocked(memeTagsInsertChain.values).mock.calls[0][0] as { memeId: string }[];
    expect(memeTagValues).toHaveLength(1);
    expect(memeTagValues[0].memeId).toBe("new-meme-1");
  });

  test("backfills imageWidth and imageHeight from fetch + imageSize", async () => {
    vi.mocked(imageSize)
      .mockReturnValueOnce({ width: 1920, height: 1080, type: "jpg" })
      .mockReturnValueOnce({ width: 640, height: 480, type: "png" });

    const { memesInsertChain } = buildMockTx();
    await main();

    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as {
      imageWidth?: number;
      imageHeight?: number;
    }[];
    expect(memeValues[0].imageWidth).toBe(1920);
    expect(memeValues[0].imageHeight).toBe(1080);
    expect(memeValues[1].imageWidth).toBe(640);
    expect(memeValues[1].imageHeight).toBe(480);
  });

  test("stores undefined dimensions when fetch fails", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const { memesInsertChain } = buildMockTx();
    await main();

    const memeValues = vi.mocked(memesInsertChain.values).mock.calls[0][0] as {
      imageWidth?: number;
      imageHeight?: number;
    }[];
    expect(memeValues[0].imageWidth).toBeUndefined();
    expect(memeValues[0].imageHeight).toBeUndefined();
  });

  test("rolls back all steps when a step fails", async () => {
    const tagsInsertChain = { values: vi.fn(), onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
    tagsInsertChain.values.mockReturnValue(tagsInsertChain);

    const tagsSelectChain = { from: vi.fn(), where: vi.fn().mockResolvedValue(INSERTED_TAGS) };
    tagsSelectChain.from.mockReturnValue(tagsSelectChain);

    const memesInsertChain = { values: vi.fn(), returning: vi.fn().mockRejectedValue(new Error("DB error")) };
    memesInsertChain.values.mockReturnValue(memesInsertChain);

    const txInsert = vi.fn().mockImplementation((table: unknown) => {
      if (table === memesTable) return memesInsertChain;
      return tagsInsertChain;
    });
    const txSelect = vi.fn().mockReturnValue(tagsSelectChain);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      try {
        await fn({ insert: txInsert, select: txSelect });
      } catch (err) {
        throw err; // transaction rolled back, re-throw
      }
    });

    await expect(main()).rejects.toThrow("DB error");
  });
});
