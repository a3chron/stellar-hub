import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // No page here is meant to be embedded, and some of them (CLI login
  // approval, account deletion, publishing) are exactly what a clickjacking
  // frame would want to overlay. X-Frame-Options for older browsers,
  // frame-ancestors for the rest. If a fuller Content-Security-Policy is ever
  // added, it has to carry this directive along rather than replace it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  images: {
    minimumCacheTTL: 2678400,
    formats: ["image/webp"],
    qualities: [75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "shcjdgwcjzkljyxanvca.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-gfm"]],
    rehypePlugins: [["rehype-slug"]],
  },
});

export default withMDX(nextConfig);
