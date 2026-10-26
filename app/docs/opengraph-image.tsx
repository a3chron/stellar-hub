import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "stellar documentation";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "docs",
    title: "Documentation",
    description:
      "Install stellar, switch Starship themes and publish your own.",
  });
}
