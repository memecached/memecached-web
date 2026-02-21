import type { InfiniteData } from "@tanstack/react-query";
import type { MemeListResponse, DashboardMemesResponse } from "./validations";

// --- Gallery (InfiniteData) helpers ---

export function removeMemeFromGalleryCache(
  data: InfiniteData<MemeListResponse> | undefined,
  ids: Set<string>,
): InfiniteData<MemeListResponse> | undefined {
  if (!data) return undefined;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      memes: page.memes.filter((m) => !ids.has(m.id)),
    })),
  };
}

export function updateMemeInGalleryCache(
  data: InfiniteData<MemeListResponse> | undefined,
  id: string,
  patch: { description?: string; tags?: string[] },
): InfiniteData<MemeListResponse> | undefined {
  if (!data) return undefined;
  const sorted = patch.tags ? { ...patch, tags: [...patch.tags].sort() } : patch;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      memes: page.memes.map((m) => (m.id === id ? { ...m, ...sorted } : m)),
    })),
  };
}

export function mergeTagsInGalleryCache(
  data: InfiniteData<MemeListResponse> | undefined,
  ids: Set<string>,
  newTags: string[],
): InfiniteData<MemeListResponse> | undefined {
  if (!data) return undefined;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      memes: page.memes.map((m) => {
        if (!ids.has(m.id)) return m;
        const merged = [...new Set([...m.tags, ...newTags])].sort();
        return { ...m, tags: merged };
      }),
    })),
  };
}

// --- Dashboard helpers ---

export function removeMemeFromDashboardCache(
  data: DashboardMemesResponse | undefined,
  ids: Set<string>,
): DashboardMemesResponse | undefined {
  if (!data) return undefined;
  const filtered = data.memes.filter((m) => !ids.has(m.id));
  return {
    ...data,
    memes: filtered,
    total: data.total - (data.memes.length - filtered.length),
  };
}

export function updateMemeInDashboardCache(
  data: DashboardMemesResponse | undefined,
  id: string,
  patch: { description?: string; tags?: string[] },
): DashboardMemesResponse | undefined {
  if (!data) return undefined;
  const sorted = patch.tags ? { ...patch, tags: [...patch.tags].sort() } : patch;
  return {
    ...data,
    memes: data.memes.map((m) => (m.id === id ? { ...m, ...sorted } : m)),
  };
}

export function mergeTagsInDashboardCache(
  data: DashboardMemesResponse | undefined,
  ids: Set<string>,
  newTags: string[],
): DashboardMemesResponse | undefined {
  if (!data) return undefined;
  return {
    ...data,
    memes: data.memes.map((m) => {
      if (!ids.has(m.id)) return m;
      const merged = [...new Set([...m.tags, ...newTags])].sort();
      return { ...m, tags: merged };
    }),
  };
}
