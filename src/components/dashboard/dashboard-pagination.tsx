"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DashboardPaginationProps {
  total: number;
  page: number;
  pageSize: number;
}

export function DashboardPagination({ total, page, pageSize }: DashboardPaginationProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    router.replace(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-xs dark:border-emerald-400/25 dark:bg-[#0a0d0b]">
      <p className="text-sm text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${start}-${end} of ${total}`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="dark:border-emerald-400/30 dark:bg-[#0a0d0b] dark:text-emerald-50 dark:hover:bg-emerald-400/10"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="dark:border-emerald-400/30 dark:bg-[#0a0d0b] dark:text-emerald-50 dark:hover:bg-emerald-400/10"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
