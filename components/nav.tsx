import { BookOpen, Github } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import QuickSearch from "@/components/search/quick-search";
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

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Icon-only on mobile so it's still reachable at narrow
                widths; text-only on sm+ to keep the previous look there. */}
            <Link
              href="/docs"
              aria-label="Docs"
              className="text-ctp-subtext1 transition hover:text-ctp-text"
            >
              <BookOpen size={18} className="sm:hidden" />
              <span className="hidden text-sm font-medium sm:inline">Docs</span>
            </Link>

            <QuickSearch />

            {/* GitHub Stars */}
            <Link
              href="https://github.com/a3chron/stellar"
              target="_blank"
              aria-label="View stellar on GitHub"
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
