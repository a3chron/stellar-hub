import { DOCS_PAGES } from "@/components/docs/pages";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

const page = DOCS_PAGES.installing;

export const alt = `${page.title} - stellar docs`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "docs",
    title: page.title,
    description: page.description,
  });
}
