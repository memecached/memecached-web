"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagInput } from "@/components/tag-input";

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isLoading: boolean;
  suggestions: string[];
  onConfirm: (tags: string[]) => void;
}

export function BulkTagDialog({
  open,
  onOpenChange,
  count,
  isLoading,
  suggestions,
  onConfirm,
}: BulkTagDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setSelectedTags([]);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tags to {count} {count === 1 ? "meme" : "memes"}</DialogTitle>
          <DialogDescription>
            Tags will be merged with existing tags (duplicates are ignored).
          </DialogDescription>
        </DialogHeader>
        <TagInput
          value={selectedTags}
          onChange={setSelectedTags}
          suggestions={suggestions}
          placeholder="Select tags to add..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedTags)}
            disabled={isLoading || selectedTags.length === 0}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Add tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
