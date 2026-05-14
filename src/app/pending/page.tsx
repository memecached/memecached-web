"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

function PendingContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "pending";
  const isRejected = status === "rejected";

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-zinc-50 p-6 text-zinc-950 dark:bg-[#050706] dark:text-zinc-50">
      <div className="w-full max-w-sm">
        <Card className="rounded-lg border-zinc-200 bg-white shadow-none dark:border-emerald-400/25 dark:bg-[#0a0d0b]">
          <CardHeader>
            <CardTitle className="text-2xl">
              {isRejected ? "Access Denied" : "Awaiting Approval"}
            </CardTitle>
            <CardDescription className="dark:text-zinc-400">
              {isRejected
                ? "Your account has been rejected. Please contact an administrator if you believe this is an error."
                : "Your account is pending approval. You'll be able to access the app once an administrator approves your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PendingPage() {
  return (
    <Suspense>
      <PendingContent />
    </Suspense>
  );
}
