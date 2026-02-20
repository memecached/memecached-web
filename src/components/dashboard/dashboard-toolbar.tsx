"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardToolbarProps {
  tags: string[];
}

const SORT_OPTIONS = [
  { label: "Newest", sortBy: "createdAt", sortOrder: "desc" },
  { label: "Oldest", sortBy: "createdAt", sortOrder: "asc" },
  { label: "A-Z", sortBy: "description", sortOrder: "asc" },
  { label: "Z-A", sortBy: "description", sortOrder: "desc" },
] as const;

function sortKey(sortBy: string, sortOrder: string) {
  return `${sortBy}:${sortOrder}`;
}

export function DashboardToolbar({ tags }: DashboardToolbarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const currentSortBy = searchParams.get("sortBy") ?? "createdAt";
  const currentSortOrder = searchParams.get("sortOrder") ?? "desc";

  const [searchInput, setSearchInput] = useState(q);

  // Debounce search input -> URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchInput) {
        params.set("q", searchInput);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
      router.replace(`/dashboard?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.replace(`/dashboard?${params.toString()}`);
  }

  function handleSortChange(value: string) {
    const [sb, so] = value.split(":");
    const params = new URLSearchParams(searchParams);
    params.set("sortBy", sb);
    params.set("sortOrder", so);
    params.set("page", "1");
    router.replace(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search memes..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2">
        <Select value={tag || "all"} onValueChange={(v) => setParam("tag", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortKey(currentSortBy, currentSortOrder)}
          onValueChange={handleSortChange}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.label} value={sortKey(opt.sortBy, opt.sortOrder)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
