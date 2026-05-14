"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Filter, ImageOff, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemeCard } from "@/components/meme-card";
import type { MemeListResponse, TagListResponse } from "@/lib/validations";
import { apiFetch } from "@/lib/api-fetch";

export function Gallery() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";

  const [searchInput, setSearchInput] = useState(q);

  // Debounce search input → URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchInput) {
        params.set("q", searchInput);
      } else {
        params.delete("q");
      }
      router.replace(`?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await apiFetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return (await res.json()) as TagListResponse;
    },
  });

  const memesQuery = useInfiniteQuery({
    queryKey: ["memes", q, tag],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      if (pageParam) params.set("cursor", pageParam);
      const res = await apiFetch(`/api/memes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch memes");
      return (await res.json()) as MemeListResponse;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const memes = memesQuery.data?.pages.flatMap((p) => p.memes) ?? [];
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = memesQuery;

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const toggleTag = (tagName: string) => {
    const params = new URLSearchParams(searchParams);
    if (tag === tagName) {
      params.delete("tag");
    } else {
      params.set("tag", tagName);
    }
    router.replace(`?${params.toString()}`);
  };

  const activeFilterCount = Number(Boolean(q)) + Number(Boolean(tag));
  const hasFilters = activeFilterCount > 0;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-[#050706] dark:text-zinc-50">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <section className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs dark:border-emerald-400/25 dark:bg-[#0a0d0b]">
          <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 dark:border-emerald-400/20 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-emerald-100/55" />
              <Input
                placeholder="Search memes..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 rounded-md border-zinc-200 bg-zinc-50 pl-9 pr-10 text-sm shadow-none dark:border-emerald-400/25 dark:bg-[#050706] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-emerald-400/60 dark:focus-visible:ring-emerald-400/20"
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-zinc-200 hover:text-foreground dark:text-emerald-100/55 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 justify-start rounded-md border-zinc-200 bg-white text-xs dark:border-emerald-400/30 dark:bg-[#0a0d0b] dark:text-emerald-50 dark:hover:bg-emerald-400/10"
                onClick={() => {
                  setSearchInput("");
                  router.replace("?");
                }}
              >
                <X className="size-3.5" />
                Reset
              </Button>
            )}
          </div>

          {tagsQuery.data && tagsQuery.data.tags.length > 0 && (
            <div className="flex items-start gap-3 p-3">
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground dark:text-emerald-100/65">
                <Filter className="size-3.5" />
                Tags
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {tagsQuery.data.tags.map((t) => (
                  <Badge
                    key={t.id}
                    variant={tag === t.name ? "default" : "outline"}
                    className={`cursor-pointer rounded-sm px-2 py-1 text-[11px] font-medium ${
                      tag === t.name
                        ? "border-emerald-500 bg-emerald-500 text-black shadow-[0_0_0_1px_rgba(16,185,129,0.25)] dark:border-emerald-300 dark:bg-emerald-300 dark:text-black"
                        : "border-emerald-500/35 bg-zinc-50 text-zinc-700 hover:border-emerald-500/60 hover:bg-emerald-50 dark:border-emerald-400/35 dark:bg-[#050706] dark:text-emerald-100/80 dark:hover:border-emerald-300/70 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-50"
                    }`}
                    onClick={() => toggleTag(t.name)}
                  >
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Loading state */}
        {memesQuery.isLoading && (
          <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white dark:border-emerald-400/25 dark:bg-[#0a0d0b]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground dark:text-emerald-200" />
          </div>
        )}

        {/* Error state */}
        {memesQuery.isError && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/30 bg-white text-destructive dark:bg-[#0a0d0b]">
            <p className="text-sm font-medium">Failed to load memes</p>
          </div>
        )}

        {/* Empty state */}
        {memesQuery.isSuccess && memes.length === 0 && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-white text-muted-foreground dark:border-emerald-400/25 dark:bg-[#0a0d0b] dark:text-emerald-100/65">
            <ImageOff className="h-10 w-10" />
            <p className="text-sm">{q || tag ? "No memes match your filters" : "No memes yet. Upload your first meme!"}</p>
          </div>
        )}

        {/* Meme grid */}
        {memes.length > 0 && (
          <div className="columns-2 gap-2 md:columns-4 md:gap-3">
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} />
            ))}
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} />

        {hasNextPage && !isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md border-zinc-200 bg-white text-xs dark:border-emerald-400/30 dark:bg-[#0a0d0b] dark:text-emerald-50 dark:hover:bg-emerald-400/10"
              onClick={() => fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        )}

        {/* Fetching next page indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>
    </div>
  );
}
