import type { QueryClient } from "@tanstack/react-query";

// Holds pre-mutation cache state for both query families so we can
// restore them if the mutation fails.
export type CacheSnapshot = {
  galleryQueries: [readonly unknown[], unknown][];
  dashboardQueries: [readonly unknown[], unknown][];
};

// Cancel any in-flight refetches for gallery and dashboard queries so they
// don't land after our optimistic write and overwrite it with stale data.
// Then snapshot every matching cache entry. We use getQueriesData (plural)
// with a partial key because multiple entries may exist per prefix — e.g.
// ["memes", "funny", ""] and ["memes", "", "cats"] are separate entries.
export async function cancelAndSnapshot(queryClient: QueryClient): Promise<CacheSnapshot> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ["memes"] }),
    queryClient.cancelQueries({ queryKey: ["dashboard-memes"] }),
  ]);

  const galleryQueries = queryClient.getQueriesData({ queryKey: ["memes"] });
  const dashboardQueries = queryClient.getQueriesData({ queryKey: ["dashboard-memes"] });

  return { galleryQueries, dashboardQueries };
}

// Restore every cache entry from the snapshot. Called in onError to undo
// the optimistic update when the server rejects the mutation.
export function rollback(queryClient: QueryClient, snapshot: CacheSnapshot): void {
  for (const [key, data] of snapshot.galleryQueries) {
    queryClient.setQueryData(key, data);
  }
  for (const [key, data] of snapshot.dashboardQueries) {
    queryClient.setQueryData(key, data);
  }
}

// Trigger background refetches for all three query families so the cache
// reconciles with the server. Called in onSettled (both success and error)
// to ensure we always converge to server truth.
export function invalidateAll(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["dashboard-memes"] });
  queryClient.invalidateQueries({ queryKey: ["memes"] });
  queryClient.invalidateQueries({ queryKey: ["tags"] });
}
