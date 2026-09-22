"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import ProfileDropdown from "./profile-dropdown";

interface AuthButtonProps {
  user: {
    id: string;
    name: string;
    // Always set in the database (NOT NULL, and the auth create hook fills it
    // for every provider), but better-auth types additional session fields as
    // optional - so it is carried as optional rather than asserted away.
    username?: string | null;
    image?: string | null;
  } | null;
}

export default function AuthButton({ user }: AuthButtonProps) {
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
        username={user.username}
        handleSignout={handleSignOut}
      />
    );
  }

  // There is more than one way in now, so the nav sends people to the login
  // page to choose rather than committing them to GitHub from the button.
  return (
    <Link
      href="/login"
      className="rounded-lg border border-ctp-surface0 bg-ctp-crust px-4 py-2 text-sm font-medium text-ctp-text transition-colors hover:bg-ctp-surface0"
    >
      Sign in
    </Link>
  );
}
