import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
