"use client";

import Image from "next/image";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Meme } from "@/lib/validations";

async function copyImage(url: string) {
  const blobPromise = fetch(url).then(async (res) => {
    const blob = await res.blob();
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png"),
    );
  });

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}

export function MemeCard({ meme }: { meme: Meme }) {
  return (
    <Card className="mb-3 break-inside-avoid overflow-hidden rounded-lg border-zinc-200 bg-white py-0 shadow-none transition-colors hover:border-zinc-300 dark:border-emerald-400/20 dark:bg-[#0a0d0b] dark:hover:border-emerald-300/45">
      <div className="group relative bg-zinc-100 dark:bg-[#050706]">
        <Image
          src={meme.imageUrl}
          alt={meme.description}
          width={meme.imageWidth ?? 0}
          height={meme.imageHeight ?? 0}
          unoptimized
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="h-auto w-full"
        />
        <div className="absolute inset-x-0 top-0 flex justify-end bg-linear-to-b from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="xs"
            variant="secondary"
            className="h-7 cursor-pointer rounded-sm bg-white text-xs text-zinc-950 shadow-sm hover:bg-zinc-100 dark:bg-emerald-300 dark:text-black dark:hover:bg-emerald-200"
            onClick={() =>
              copyImage(meme.imageUrl)
                .then(() => toast.success("Image copied"))
                .catch(() => toast.error("Failed to copy image"))
            }
          >
            <Copy className="size-3" />
            Copy
          </Button>
        </div>
      </div>
      <CardContent className="px-3 pt-3">
        <p className="line-clamp-2 text-sm leading-5 text-zinc-800 dark:text-zinc-200">{meme.description}</p>
      </CardContent>
      {meme.tags.length > 0 && (
        <CardFooter className="flex-wrap gap-1 px-3 pb-3 pt-3">
          {meme.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="rounded-sm border border-emerald-500/35 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-emerald-400/35 dark:bg-[#050706] dark:text-emerald-100/70"
            >
              {tag}
            </Badge>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
