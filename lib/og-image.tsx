import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Shared look for the generated Open Graph images (home and docs): Catppuccin
// Mocha with the site's Geist Mono. The font is vendored under assets/fonts
// because next/font/google only hands out CSS, not a file ImageResponse can
// load - and fetching it during `next build` would make the build depend on
// the network.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const MOCHA = {
  base: "#1e1e2e",
  mantle: "#181825",
  surface0: "#313244",
  text: "#cdd6f4",
  subtext0: "#a6adc8",
  overlay1: "#7f849c",
  mauve: "#cba6f7",
  green: "#a6e3a1",
};

// Same path as components/icons/asterisk.tsx.
const ASTERISK_PATH =
  "M11.25 21V13.8L6.175 18.875l-1.05 -1.05L10.2 12.75H3v-1.5h7.225l-5.1 -5.1 1.05 -1.05L11.25 10.175V3h1.5v7.2l5.1 -5.1 1.05 1.05 -5.1 5.1H21v1.5H13.825L18.9 17.825l-1.05 1.05 -5.1 -5.1V21h-1.5Z";

const fontPath = (file: string) => join(process.cwd(), "assets", "fonts", file);

export async function renderOgImage({
  eyebrow,
  title,
  description,
}: {
  /** Small label above the title, e.g. "docs". */
  eyebrow?: string;
  title: string;
  description: string;
}) {
  const [regular, bold] = await Promise.all([
    readFile(fontPath("GeistMono-Regular.ttf")),
    readFile(fontPath("GeistMono-Bold.ttf")),
  ]);

  // Long titles (the homepage tagline) drop a size so they stay on two lines.
  const titleSize = title.length > 24 ? 64 : 76;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: MOCHA.base,
        backgroundImage: `radial-gradient(circle at 100% 0%, ${MOCHA.surface0} 0%, ${MOCHA.base} 55%)`,
        color: MOCHA.text,
        fontFamily: "Geist Mono",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: rasterized into the PNG, never part of a DOM */}
        <svg width="64" height="64" viewBox="0 0 24 24" fill={MOCHA.mauve}>
          <path d={ASTERISK_PATH} />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 700 }}>stellar</span>
        {eyebrow && (
          <span
            style={{
              fontSize: 30,
              color: MOCHA.mauve,
              border: `2px solid ${MOCHA.surface0}`,
              backgroundColor: MOCHA.mantle,
              borderRadius: 12,
              padding: "4px 16px",
              marginLeft: 8,
            }}
          >
            {eyebrow}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 34, lineHeight: 1.4, color: MOCHA.subtext0 }}>
          {description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28,
          color: MOCHA.overlay1,
        }}
      >
        <span>
          <span style={{ color: MOCHA.green }}>{">"}</span>&nbsp;stellar apply
          author/theme
        </span>
        <span>stellar.a3chron.dev</span>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist Mono", data: regular, weight: 400, style: "normal" },
        { name: "Geist Mono", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
