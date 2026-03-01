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
    <Card className="mb-4 break-inside-avoid overflow-hidden py-0">
      <div className="group relative bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={meme.imageUrl}
          alt={meme.description}
          width={meme.imageWidth ?? 0}
          height={meme.imageHeight ?? 0}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="h-auto w-full"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              copyImage(meme.imageUrl)
                .then(() => toast.success("Image copied"))
                .catch(() => toast.error("Failed to copy image"))
            }
          >
            <Copy className="mr-1 h-4 w-4" />
            Copy image
          </Button>
        </div>
      </div>
      <CardContent className="pt-4">
        <p className="text-sm line-clamp-2">{meme.description}</p>
      </CardContent>
      {meme.tags.length > 0 && (
        <CardFooter className="flex-wrap gap-1 pb-4">
          {meme.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
