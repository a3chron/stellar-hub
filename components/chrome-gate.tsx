"use client";

import { usePathname } from "next/navigation";

// Routes that render their own full-screen shell (components/auth/auth-shell)
// and supply their own branding. The site nav and footer would otherwise sit
// around a min-h-screen panel, showing the Stellar wordmark twice and forcing
// the "full screen" login page to scroll.
const BARE_ROUTES = ["/login", "/forgot-password", "/reset-password"];

/**
 * Hides the site chrome on the auth pages.
 *
 * Nav and Footer live in the root layout so every page gets them by default;
 * a nested layout cannot remove them, only add to them. This gates them on the
 * path instead, which keeps the default intact and the exception in one place.
 *
 * Children stay server components - they are rendered on the server and passed
 * in; this only decides whether to output them.
 */
export default function ChromeGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (BARE_ROUTES.some((route) => pathname === route)) {
    return null;
  }

  return <>{children}</>;
}
