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
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isRejected ? "Access Denied" : "Awaiting Approval"}
            </CardTitle>
            <CardDescription>
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
