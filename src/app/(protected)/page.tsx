"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Gallery } from "@/components/gallery";

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <Gallery />
    </Suspense>
  );
}
