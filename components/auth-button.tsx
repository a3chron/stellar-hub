"use client";

import { authClient } from "@/lib/auth-client";
import ProfileDropdown from "./profile-dropdown";

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
      <ProfileDropdown
        userImage={user.image}
        userName={user.name}
        handleSignout={handleSignOut}
      />
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
