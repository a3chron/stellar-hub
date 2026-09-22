import { Github } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-t-ctp-crust bg-ctp-mantle mt-24">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ctp-subtext0">
          <p>Stellar - Starship prompt themes, one command away.</p>
          <nav className="flex items-center gap-6">
            <Link
              href="/docs"
              className="hover:text-ctp-text transition-colors"
            >
              Docs
            </Link>
            {/* Reachable from every page on purpose: a privacy policy nobody
                can find does not do its job, and Google's OAuth review looks
                for it to be linked. */}
            <Link
              href="/legal#privacy"
              className="hover:text-ctp-text transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/legal#terms"
              className="hover:text-ctp-text transition-colors"
            >
              Terms
            </Link>
            <Link
              href="https://github.com/a3chron/stellar"
              target="_blank"
              aria-label="Stellar on GitHub"
              className="hover:text-ctp-text transition-colors"
            >
              <Github size={16} />
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
