"use client";

import { Github } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AsteriskLogo from "@/components/icons/asterisk";
import { authClient } from "@/lib/auth-client";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  async function handleSignIn() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: callbackUrl,
    });
  }

  return (
    <main className="min-h-screen bg-ctp-base flex items-center justify-center">
      <div className="w-full max-w-md px-4 pb-32">
        <div className="bg-ctp-mantle border border-ctp-surface0 rounded-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <AsteriskLogo width={48} height={48} />
            <h1 className="text-2xl font-bold text-ctp-text mt-4 text-center">
              Welcome to Stellar
            </h1>
            <p className="text-ctp-subtext0 mt-2 text-center">
              Sign in to publish and manage your Starship themes
            </p>
          </div>

          <button
            onClick={handleSignIn}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text rounded-lg font-medium transition-colors cursor-pointer"
          >
            <Github size={20} />
            Continue with GitHub
          </button>

          <p className="text-ctp-subtext0 text-sm text-center mt-6">
            By signing in, you share your GitHub username and profile picture
            with Stellar.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-ctp-base flex items-center justify-center">
          <div className="text-ctp-subtext0">Loading...</div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
