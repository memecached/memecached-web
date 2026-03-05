"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { UserTable } from "@/components/admin/user-table";

function AdminUsersContent() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <UserTable />
      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
