"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagInput } from "@/components/tag-input";
import type { Meme } from "@/lib/validations";

interface MemeTableRowProps {
  meme: Meme;
  isSelected: boolean;
  isSaving: boolean;
  onSelect: (checked: boolean) => void;
  onSave: (data: { description?: string; tags?: string[] }) => void;
  onDelete: () => void;
  tagSuggestions: string[];
}

export function MemeTableRow({
  meme,
  isSelected,
  isSaving,
  onSelect,
  onSave,
  onDelete,
  tagSuggestions,
}: MemeTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(meme.description);
  const [editTags, setEditTags] = useState<string[]>(meme.tags);

  function startEditing() {
    setEditDescription(meme.description);
    setEditTags([...meme.tags]);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function handleSave() {
    const changes: { description?: string; tags?: string[] } = {};
    if (editDescription !== meme.description) {
      changes.description = editDescription;
    }
    const sortedEdit = [...editTags].sort();
    const sortedOrig = [...meme.tags].sort();
    if (JSON.stringify(sortedEdit) !== JSON.stringify(sortedOrig)) {
      changes.tags = editTags;
    }
    if (Object.keys(changes).length > 0) {
      onSave(changes);
    }
    setIsEditing(false);
  }

  return (
    <TableRow data-state={isSelected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(checked === true)}
          aria-label={`Select ${meme.description}`}
        />
      </TableCell>
      <TableCell>
        <div className="relative h-12 w-12">
          <img
            src={meme.imageUrl}
            alt={meme.description}
            className={`h-12 w-12 rounded object-cover transition-[filter] ${isSaving ? "blur-[2px]" : ""}`}
          />
          {isSaving && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white drop-shadow" />
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[300px]">
        {isEditing ? (
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="h-8"
          />
        ) : (
          <span className="line-clamp-2">{meme.description}</span>
        )}
      </TableCell>
      <TableCell className="max-w-[250px]">
        {isEditing ? (
          <TagInput
            value={editTags}
            onChange={setEditTags}
            suggestions={tagSuggestions}
            placeholder="Edit tags..."
          />
        ) : (
          <div className="flex flex-wrap gap-1">
            {meme.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell>
        {new Date(meme.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={cancelEditing}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startEditing}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}
