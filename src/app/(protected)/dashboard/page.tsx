"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MemeTable } from "@/components/dashboard/meme-table";

function DashboardContent() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 dark:bg-[#050706] dark:text-zinc-50">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <MemeTable />
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#050706]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground dark:text-emerald-200" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
