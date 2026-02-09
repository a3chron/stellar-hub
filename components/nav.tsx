import { Github } from "lucide-react";
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
    <nav className="border-b border-b-ctp-crust bg-ctp-mantle sticky top-0 z-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold flex gap-2 items-center text-ctp-text"
          >
            <AsteriskLogo width={36} height={36} />
          </Link>

          <div className="flex items-center gap-8">
            {/* GitHub Stars */}
            <Link
              href="https://github.com/a3chron/stellar"
              target="_blank"
              className="text-ctp-subtext1"
            >
              <Github size={18} />
            </Link>

            <AuthButton user={session?.user || null} />
          </div>
        </div>
      </div>
    </nav>
  );
}
