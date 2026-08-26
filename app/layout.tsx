import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Nav from "@/components/nav";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stellar",
  description: "Web Hub for starship configs",
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
      <body className={`${geistMono.variable} antialiased`}>
        <Analytics />
        <SpeedInsights />
        <Nav />
        {children}
      </body>
    </html>
  );
}
