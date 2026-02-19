import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Stellar",
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
