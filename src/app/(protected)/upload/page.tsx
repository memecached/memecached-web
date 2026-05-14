import { UploadForm } from "@/components/upload-form";
import { ImageUp } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950 dark:bg-[#050706] dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-xl space-y-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-md border border-emerald-500/35 bg-white text-emerald-700 dark:border-emerald-400/35 dark:bg-[#0a0d0b] dark:text-emerald-300">
              <ImageUp className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Upload a meme
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Drop an image below to add it to your collection.
            </p>
          </div>

          <UploadForm />
        </div>
      </main>
    </div>
  );
}
