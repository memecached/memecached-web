"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Loader2, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardToolbar } from "./dashboard-toolbar";
import { DashboardPagination } from "./dashboard-pagination";
import { MemeTableRow } from "./meme-table-row";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";
import { BulkTagDialog } from "./bulk-tag-dialog";
import type { DashboardMemesResponse, MemeListResponse, TagListResponse } from "@/lib/validations";
import { cancelAndSnapshot, rollback, invalidateAll } from "@/lib/optimistic-cache";
import {
  removeMemeFromGalleryCache,
  removeMemeFromDashboardCache,
  updateMemeInGalleryCache,
  updateMemeInDashboardCache,
  mergeTagsInGalleryCache,
  mergeTagsInDashboardCache,
} from "@/lib/optimistic-updates";

export function MemeTable() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const q = searchParams.get("q") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";
  const page = Number(searchParams.get("page") ?? "1");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);

  // Fetch memes
  const memesQuery = useQuery({
    queryKey: ["dashboard-memes", q, tag, sortBy, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", String(page));
      const res = await fetch(`/api/memes/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch memes");
      return (await res.json()) as DashboardMemesResponse;
    },
  });

  // Fetch tags
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return (await res.json()) as TagListResponse;
    },
  });

  const memes = memesQuery.data?.memes ?? [];
  const total = memesQuery.data?.total ?? 0;
  const pageSize = memesQuery.data?.pageSize ?? 20;
  const tagNames = tagsQuery.data?.tags.map((t) => t.name) ?? [];

  // Clear selection on page/filter change
  const queryKey = `${q}|${tag}|${sortBy}|${sortOrder}|${page}`;
  const [prevKey, setPrevKey] = useState(queryKey);
  if (queryKey !== prevKey) {
    setSelectedIds(new Set());
    setPrevKey(queryKey);
  }

  // Mutations with optimistic updates

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { description?: string; tags?: string[] } }) => {
      const res = await fetch(`/api/memes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update meme");
    },
    onMutate: async ({ id, data }) => {
      const snapshot = await cancelAndSnapshot(queryClient);
      for (const [key] of snapshot.galleryQueries) {
        queryClient.setQueryData(key, (old: InfiniteData<MemeListResponse> | undefined) =>
          updateMemeInGalleryCache(old, id, data),
        );
      }
      for (const [key] of snapshot.dashboardQueries) {
        queryClient.setQueryData(key, (old: DashboardMemesResponse | undefined) =>
          updateMemeInDashboardCache(old, id, data),
        );
      }
      return { snapshot };
    },
    onSuccess: () => toast.success("Meme updated"),
    onError: (_err, _vars, context) => {
      if (context?.snapshot) rollback(queryClient, context.snapshot);
      toast.error("Failed to update meme");
    },
    onSettled: () => invalidateAll(queryClient),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 1) {
        const res = await fetch(`/api/memes/${ids[0]}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete meme");
      } else {
        const res = await fetch("/api/memes/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("Failed to delete memes");
      }
    },
    onMutate: async (ids) => {
      const snapshot = await cancelAndSnapshot(queryClient);
      const idSet = new Set(ids);
      for (const [key] of snapshot.galleryQueries) {
        queryClient.setQueryData(key, (old: InfiniteData<MemeListResponse> | undefined) =>
          removeMemeFromGalleryCache(old, idSet),
        );
      }
      for (const [key] of snapshot.dashboardQueries) {
        queryClient.setQueryData(key, (old: DashboardMemesResponse | undefined) =>
          removeMemeFromDashboardCache(old, idSet),
        );
      }
      return { snapshot };
    },
    onSuccess: (_data, ids) => {
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(ids.length === 1 ? "Meme deleted" : `${ids.length} memes deleted`);
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) rollback(queryClient, context.snapshot);
      toast.error("Failed to delete");
    },
    onSettled: () => invalidateAll(queryClient),
  });

  const bulkTagMutation = useMutation({
    mutationFn: async ({ tags: tagList, ids }: { tags: string[]; ids: string[] }) => {
      const res = await fetch("/api/memes/bulk-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, tags: tagList }),
      });
      if (!res.ok) throw new Error("Failed to add tags");
    },
    onMutate: async ({ tags: tagList, ids }) => {
      const snapshot = await cancelAndSnapshot(queryClient);
      const idSet = new Set(ids);
      for (const [key] of snapshot.galleryQueries) {
        queryClient.setQueryData(key, (old: InfiniteData<MemeListResponse> | undefined) =>
          mergeTagsInGalleryCache(old, idSet, tagList),
        );
      }
      for (const [key] of snapshot.dashboardQueries) {
        queryClient.setQueryData(key, (old: DashboardMemesResponse | undefined) =>
          mergeTagsInDashboardCache(old, idSet, tagList),
        );
      }
      return { snapshot };
    },
    onSuccess: () => {
      setBulkTagOpen(false);
      toast.success("Tags added");
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) rollback(queryClient, context.snapshot);
      toast.error("Failed to add tags");
    },
    onSettled: () => invalidateAll(queryClient),
  });

  // Selection helpers
  const allSelected = memes.length > 0 && memes.every((m) => selectedIds.has(m.id));
  const someSelected = memes.some((m) => selectedIds.has(m.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memes.map((m) => m.id)));
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <DashboardToolbar tags={tagNames} />

      {/* Bulk actions bar */}
      <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : "None selected"}
        </span>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={() => setDeleteTarget(Array.from(selectedIds))}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button variant="outline" size="sm" disabled={selectedIds.size === 0} onClick={() => setBulkTagOpen(true)}>
          <Tags className="h-4 w-4" />
          Add tags
        </Button>
      </div>

      {/* Loading */}
      {memesQuery.isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {memesQuery.isError && (
        <div className="flex justify-center py-12 text-destructive">
          <p>Failed to load memes</p>
        </div>
      )}

      {/* Table */}
      {memesQuery.isSuccess && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {memes.length === 0 ? (
                <TableRow>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No memes found
                  </td>
                </TableRow>
              ) : (
                memes.map((meme) => (
                  <MemeTableRow
                    key={meme.id}
                    meme={meme}
                    isSelected={selectedIds.has(meme.id)}
                    isSaving={patchMutation.isPending && patchMutation.variables?.id === meme.id}
                    onSelect={(checked) => toggleSelect(meme.id, checked)}
                    onSave={(data) => patchMutation.mutate({ id: meme.id, data })}
                    onDelete={() => setDeleteTarget([meme.id])}
                    tagSuggestions={tagNames}
                  />
                ))
              )}
            </TableBody>
          </Table>

          <DashboardPagination total={total} page={page} pageSize={pageSize} />
        </>
      )}

      {/* Dialogs */}
      <DeleteConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        count={deleteTarget?.length ?? 0}
        isLoading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
      />

      <BulkTagDialog
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        count={selectedIds.size}
        isLoading={bulkTagMutation.isPending}
        suggestions={tagNames}
        onConfirm={(tagList) => bulkTagMutation.mutate({ tags: tagList, ids: Array.from(selectedIds) })}
      />
    </div>
  );
}
