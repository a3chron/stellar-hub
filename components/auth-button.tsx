// components/auth-button.tsx
"use client";

import Image from "next/image";
import { authClient } from "@/lib/auth-client";

interface AuthButtonProps {
  user: {
    id: string;
    name: string;
    image?: string | null;
  } | null;
}

export default function AuthButton({ user }: AuthButtonProps) {
  async function handleSignIn() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    });
  }

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        {user.image && (
          <Image
            src={user.image}
            alt={user.name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-sm font-medium text-ctp-subtext1">
          {user.name}
        </span>
        <button
          onClick={handleSignOut}
          type="submit"
          className="px-4 py-2 text-sm font-medium text-ctp-subtext1"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      type="submit"
      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
    >
      Sign In with GitHub
    </button>
  );
}
