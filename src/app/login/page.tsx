import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginButtons } from "@/components/login-buttons";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-zinc-50 p-6 text-zinc-950 dark:bg-[#050706] dark:text-zinc-50">
      <div className="w-full max-w-sm">
        <Card className="rounded-lg border-zinc-200 bg-white shadow-none dark:border-emerald-400/25 dark:bg-[#0a0d0b]">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription className="dark:text-zinc-400">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginButtons />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
