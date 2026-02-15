import { LogoutButton } from "@/components/logout-button";
import { UploadForm } from "@/components/upload-form";
import { ImageUp } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            memecached
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
              <ImageUp className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
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
