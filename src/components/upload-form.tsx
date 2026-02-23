"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/tag-input";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { SUCCESS_DISPLAY_MS } from "@/lib/constants";
import { MAX_FILE_SIZE, ACCEPTED_MIME_TYPES } from "@/lib/constants";
import { createMemeSchema } from "@/lib/validations";
import type { TagListResponse } from "@/lib/validations";
import { invalidateAll } from "@/lib/optimistic-cache";
import { apiFetch } from "@/lib/api-fetch";

const formSchema = createMemeSchema.omit({ imageUrl: true });

type FormValues = z.infer<typeof formSchema>;

type UploadState =
  | { status: "idle" }
  | { status: "previewing" }
  | { status: "uploading" }
  | { status: "success"; imageUrl: string }
  | { status: "error"; message: string };

export function UploadForm() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
  });

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await apiFetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return (await res.json()) as TagListResponse;
    },
  });
  const availableTags = tagsQuery.data?.tags.map((t) => t.name) ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { description: "", tags: [] },
  });

  const onDrop = useCallback((acceptedFiles: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      const error = rejections[0].errors[0];
      if (error.code === "file-too-large") {
        toast.error("File exceeds 2 MB limit");
      } else if (error.code === "file-invalid-type") {
        toast.error("Invalid file type. Use PNG, JPEG, GIF, or WebP");
      } else {
        toast.error(error.message);
      }
      return;
    }

    const f = acceptedFiles[0];
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setUploadState({ status: "previewing" });
  }, []);

  const onSubmit = async (data: FormValues) => {
    if (!file) return;

    setUploadState({ status: "uploading" });

    try {
      const res = await apiFetch(`/api/upload-url?filename=${encodeURIComponent(file.name)}`);

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to get upload URL");
      }

      const { uploadUrl, imageUrl } = await res.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        throw new Error("Upload to S3 failed");
      }

      const memeRes = await apiFetch("/api/memes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          description: data.description,
          tags: data.tags,
        }),
      });

      if (!memeRes.ok) {
        const body = await memeRes.json();
        throw new Error(body.error ?? "Failed to create meme");
      }

      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setFile(null);
      resetForm();
      setUploadState({ status: "success", imageUrl });
      invalidateAll(queryClient);
    } catch (err) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  };

  // Display success message for SUCCESS_DISPLAY_MS seconds
  // then reset upload form status
  useEffect(() => {
    if (uploadState.status !== "success") return;
    const timer = setTimeout(() => {
      setUploadState({ status: "idle" });
    }, SUCCESS_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [uploadState.status]);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    resetForm();
    setUploadState({ status: "idle" });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled:
      uploadState.status === "uploading" || uploadState.status === "previewing" || uploadState.status === "success",
  });

  const showDropzone = uploadState.status === "idle" || uploadState.status === "error";

  return (
    <div className="w-full max-w-md space-y-4">
      {showDropzone && (
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
              : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mb-3 h-8 w-8 text-zinc-400" />
          {isDragActive ? (
            <p className="text-sm text-blue-600 dark:text-blue-400">Drop your image here</p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Drag & drop an image, or click to select</p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">PNG, JPEG, GIF, WebP — max 2 MB</p>
            </>
          )}
        </div>
      )}

      {preview && (
        <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Upload preview"
            className={`h-auto w-full object-contain transition-all ${
              uploadState.status === "uploading" ? "blur-sm" : ""
            }`}
          />
          {uploadState.status === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <p className="text-sm font-medium text-white">Uploading...</p>
            </div>
          )}
        </div>
      )}

      {(uploadState.status === "previewing" || uploadState.status === "uploading") && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Describe your meme..."
              disabled={uploadState.status === "uploading"}
              {...register("description")}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium">
              Tags
            </label>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <TagInput
                  id="tags"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={availableTags}
                  placeholder="Add tags..."
                  disabled={uploadState.status === "uploading"}
                />
              )}
            />
            {errors.tags && <p className="mt-1 text-xs text-red-500">{errors.tags.message}</p>}
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!isValid || uploadState.status === "uploading"}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <Button type="button" variant="outline" onClick={reset} disabled={uploadState.status === "uploading"}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </form>
      )}

      {uploadState.status === "success" && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-green-600 dark:text-green-400">
          <CheckCircle className="h-10 w-10" />
          <p className="text-sm font-medium">Uploaded successfully</p>
        </div>
      )}

      {uploadState.status === "error" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            {uploadState.message}
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="mr-1 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
