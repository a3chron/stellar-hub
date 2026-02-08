// components/auth-button.tsx
"use client";

import { UserIcon } from "lucide-react";
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
        <span className="text-sm font-medium text-ctp-subtext1">
          {user.name}
        </span>
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <UserIcon size={32} />
        )}
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
      className="px-4 py-2 bg-ctp-crust border border-ctp-surface0 text-ctp-text rounded-lg text-sm font-medium cursor-pointer"
    >
      Sign In with GitHub
    </button>
  );
}
