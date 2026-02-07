import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import AuthButton from "./auth-button";
import AsteriskLogo from "./icons/asterisk";

export default async function Nav() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <nav className="border-b border-b-ctp-crust bg-ctp-mantle">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold flex gap-2 items-center text-ctp-text"
          >
            <AsteriskLogo width={36} height={36} />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-ctp-subtext1">
              Themes
            </Link>

            {session && (
              <>
                <Link
                  href="/upload"
                  className="text-sm font-medium text-ctp-subtext1"
                >
                  Upload
                </Link>
                <Link
                  href={`/${session.user.name}`}
                  className="text-sm font-medium text-ctp-subtext1"
                >
                  My Profile
                </Link>
              </>
            )}

            <AuthButton user={session?.user || null} />
          </div>
        </div>
      </div>
    </nav>
  );
}
