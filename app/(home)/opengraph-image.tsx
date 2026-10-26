import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "stellar - Beautiful Starship themes, one command away";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    title: "Beautiful Starship themes, one command away",
    description:
      "Browse community prompt themes and apply them with the stellar CLI.",
  });
}
