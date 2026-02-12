"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function OAuthButton({
  provider,
  label,
}: {
  provider: "google" | "github";
  label: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleLogin}
      disabled={isLoading}
    >
      {isLoading ? "Redirecting..." : label}
    </Button>
  );
}

export function LoginButtons() {
  return (
    <div className="flex flex-col gap-3">
      <OAuthButton provider="google" label="Continue with Google" />
      <OAuthButton provider="github" label="Continue with GitHub" />
    </div>
  );
}
