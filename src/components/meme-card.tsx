import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Meme } from "@/lib/validations";

export function MemeCard({ meme }: { meme: Meme }) {
  return (
    <Card className="mb-4 break-inside-avoid overflow-hidden py-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meme.imageUrl}
        alt={meme.description}
        className="w-full"
      />
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
