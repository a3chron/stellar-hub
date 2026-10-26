import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ChromeGate from "@/components/chrome-gate";
import Footer from "@/components/footer";
import Nav from "@/components/nav";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://stellar.a3chron.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Stellar",
    template: "%s - Stellar",
  },
  description:
    "Discover, preview and install community-made Starship shell prompt themes with the stellar CLI.",
  // No title/description here: Next fills og:/twitter: title and description
  // from each page's own when the openGraph object leaves them out. Setting
  // them pinned every page that has no openGraph of its own to the
  // homepage's text, and the fixed url pointed all of them at the homepage.
  openGraph: {
    siteName: "Stellar",
    type: "website",
    url: "./",
  },
  // Every page declares itself canonical ("./" resolves against each route's
  // own path), so query-string variants Google crawls - ?_rsc=… prefetches,
  // ?utm_… links - fold into the clean URL instead of being reported as
  // "Duplicate without user-selected canonical".
  alternates: {
    canonical: "./",
  },
  verification: {
    google: "waG0eqk7cOJVSMbB42gHQIR-bDsRmy5ABoQWNFI8UKQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior lets Next.js suppress the CSS smooth scrolling
    // during route transitions (instant jump to top), while in-page anchor
    // clicks (docs ToC) stay smooth.
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistMono.variable} antialiased flex min-h-screen flex-col`}
      >
        <Analytics />
        <SpeedInsights />
        <ChromeGate>
          <Nav />
        </ChromeGate>
        {/* flex-1 is what pins the footer to the bottom on short pages. */}
        <div className="flex-1">{children}</div>
        <ChromeGate>
          <Footer />
        </ChromeGate>
      </body>
    </html>
  );
}
