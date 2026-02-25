import Image from "next/image";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Meme } from "@/lib/validations";

export function MemeCard({ meme }: { meme: Meme }) {
  return (
    <Card className="mb-4 break-inside-avoid overflow-hidden py-0">
      <div className="bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={meme.imageUrl}
          alt={meme.description}
          width={meme.imageWidth ?? 0}
          height={meme.imageHeight ?? 0}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="h-auto w-full"
        />
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
