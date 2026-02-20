"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Search, Loader2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { MemeCard } from "@/components/meme-card";
import type { MemeListResponse, TagListResponse } from "@/lib/validations";

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
      const res = await fetch("/api/tags");
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
      const res = await fetch(`/api/memes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch memes");
      return (await res.json()) as MemeListResponse;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const memes = memesQuery.data?.pages.flatMap((p) => p.memes) ?? [];

  const toggleTag = (tagName: string) => {
    const params = new URLSearchParams(searchParams);
    if (tag === tagName) {
      params.delete("tag");
    } else {
      params.set("tag", tagName);
    }
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b bg-white dark:bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">memecached</h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/upload">Upload</Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memes..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tag filter */}
        {tagsQuery.data && tagsQuery.data.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tagsQuery.data.tags.map((t) => (
              <Badge
                key={t.id}
                variant={tag === t.name ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(t.name)}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Loading state */}
        {memesQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {memesQuery.isError && (
          <div className="flex flex-col items-center gap-2 py-12 text-destructive">
            <p>Failed to load memes</p>
          </div>
        )}

        {/* Empty state */}
        {memesQuery.isSuccess && memes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <ImageOff className="h-12 w-12" />
            <p>{q || tag ? "No memes match your filters" : "No memes yet. Upload your first meme!"}</p>
          </div>
        )}

        {/* Meme grid */}
        {memes.length > 0 && (
          <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4">
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} />
            ))}
          </div>
        )}

        {/* Load more */}
        {memesQuery.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => memesQuery.fetchNextPage()}
              disabled={memesQuery.isFetchingNextPage}
            >
              {memesQuery.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
