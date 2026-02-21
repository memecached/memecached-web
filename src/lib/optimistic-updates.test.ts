import { describe, it, expect } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import type { MemeListResponse, DashboardMemesResponse, Meme } from "./validations";
import {
  removeMemeFromGalleryCache,
  removeMemeFromDashboardCache,
  updateMemeInGalleryCache,
  updateMemeInDashboardCache,
  mergeTagsInGalleryCache,
  mergeTagsInDashboardCache,
} from "./optimistic-updates";

function makeMeme(overrides: Partial<Meme> & { id: string }): Meme {
  return {
    description: "test",
    tags: [],
    imageUrl: "https://example.com/img.png",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as Meme;
}

function makeGalleryData(pages: Meme[][]): InfiniteData<MemeListResponse> {
  return {
    pages: pages.map((memes) => ({ memes, nextCursor: null })),
    pageParams: pages.map((_, i) => (i === 0 ? null : `cursor-${i}`)),
  };
}

function makeDashboardData(memes: Meme[], total?: number): DashboardMemesResponse {
  return { memes, total: total ?? memes.length, page: 1, pageSize: 20 };
}

// --- removeMemeFromGalleryCache ---

describe("removeMemeFromGalleryCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(removeMemeFromGalleryCache(undefined, new Set(["a"]))).toBeUndefined();
  });

  it("removes matching memes from all pages", () => {
    const data = makeGalleryData([
      [makeMeme({ id: "a" }), makeMeme({ id: "b" })],
      [makeMeme({ id: "c" }), makeMeme({ id: "d" })],
    ]);
    const result = removeMemeFromGalleryCache(data, new Set(["a", "c"]));
    expect(result!.pages[0].memes).toHaveLength(1);
    expect(result!.pages[0].memes[0].id).toBe("b");
    expect(result!.pages[1].memes).toHaveLength(1);
    expect(result!.pages[1].memes[0].id).toBe("d");
  });

  it("preserves pageParams", () => {
    const data = makeGalleryData([[makeMeme({ id: "a" })]]);
    const result = removeMemeFromGalleryCache(data, new Set(["a"]));
    expect(result!.pageParams).toEqual(data.pageParams);
  });
});

// --- removeMemeFromDashboardCache ---

describe("removeMemeFromDashboardCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(removeMemeFromDashboardCache(undefined, new Set(["a"]))).toBeUndefined();
  });

  it("removes memes and adjusts total", () => {
    const data = makeDashboardData(
      [makeMeme({ id: "a" }), makeMeme({ id: "b" }), makeMeme({ id: "c" })],
      10,
    );
    const result = removeMemeFromDashboardCache(data, new Set(["a", "c"]));
    expect(result!.memes).toHaveLength(1);
    expect(result!.memes[0].id).toBe("b");
    expect(result!.total).toBe(8);
  });
});

// --- updateMemeInGalleryCache ---

describe("updateMemeInGalleryCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(updateMemeInGalleryCache(undefined, "a", { description: "new" })).toBeUndefined();
  });

  it("updates description for matching meme and leaves others untouched", () => {
    const data = makeGalleryData([
      [makeMeme({ id: "a", description: "old" }), makeMeme({ id: "b", description: "keep" })],
    ]);
    const result = updateMemeInGalleryCache(data, "a", { description: "new" });
    expect(result!.pages[0].memes[0].description).toBe("new");
    expect(result!.pages[0].memes[1].description).toBe("keep");
  });

  it("sorts tags for matching meme", () => {
    const data = makeGalleryData([[makeMeme({ id: "a", tags: ["old"] })]]);
    const result = updateMemeInGalleryCache(data, "a", { tags: ["zebra", "alpha"] });
    expect(result!.pages[0].memes[0].tags).toEqual(["alpha", "zebra"]);
  });
});

// --- updateMemeInDashboardCache ---

describe("updateMemeInDashboardCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(updateMemeInDashboardCache(undefined, "a", { description: "new" })).toBeUndefined();
  });

  it("updates description for matching meme and leaves others untouched", () => {
    const data = makeDashboardData([
      makeMeme({ id: "a", description: "old" }),
      makeMeme({ id: "b", description: "keep" }),
    ]);
    const result = updateMemeInDashboardCache(data, "a", { description: "new" });
    expect(result!.memes[0].description).toBe("new");
    expect(result!.memes[1].description).toBe("keep");
  });
});

// --- mergeTagsInGalleryCache ---

describe("mergeTagsInGalleryCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(mergeTagsInGalleryCache(undefined, new Set(["a"]), ["t1"])).toBeUndefined();
  });

  it("merges tags without duplicates and sorts", () => {
    const data = makeGalleryData([
      [makeMeme({ id: "a", tags: ["existing", "shared"] })],
    ]);
    const result = mergeTagsInGalleryCache(data, new Set(["a"]), ["shared", "new"]);
    expect(result!.pages[0].memes[0].tags).toEqual(["existing", "new", "shared"]);
  });

  it("leaves non-matching memes untouched", () => {
    const data = makeGalleryData([
      [makeMeme({ id: "a", tags: ["t1"] }), makeMeme({ id: "b", tags: ["t2"] })],
    ]);
    const result = mergeTagsInGalleryCache(data, new Set(["a"]), ["new"]);
    expect(result!.pages[0].memes[0].tags).toEqual(["new", "t1"]);
    expect(result!.pages[0].memes[1].tags).toEqual(["t2"]);
  });
});

// --- mergeTagsInDashboardCache ---

describe("mergeTagsInDashboardCache", () => {
  it("returns undefined when data is undefined", () => {
    expect(mergeTagsInDashboardCache(undefined, new Set(["a"]), ["t1"])).toBeUndefined();
  });

  it("merges tags without duplicates and sorts", () => {
    const data = makeDashboardData([
      makeMeme({ id: "a", tags: ["existing", "shared"] }),
    ]);
    const result = mergeTagsInDashboardCache(data, new Set(["a"]), ["shared", "new"]);
    expect(result!.memes[0].tags).toEqual(["existing", "new", "shared"]);
  });

  it("leaves non-matching memes untouched", () => {
    const data = makeDashboardData([
      makeMeme({ id: "a", tags: ["t1"] }),
      makeMeme({ id: "b", tags: ["t2"] }),
    ]);
    const result = mergeTagsInDashboardCache(data, new Set(["a"]), ["new"]);
    expect(result!.memes[0].tags).toEqual(["new", "t1"]);
    expect(result!.memes[1].tags).toEqual(["t2"]);
  });
});
