import type { Metadata } from "next";

export const metadata: Metadata = {
  // The root layout now applies a "%s - Stellar" title template, so the
  // suffix here would double up.
  title: "Sign In",
  description:
    "Sign in to Stellar to publish and manage your Starship shell prompt themes.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
