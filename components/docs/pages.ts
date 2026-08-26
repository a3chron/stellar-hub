import { Bug, Cog, Download, Palette, Terminal } from "lucide-react";

/**
 * Single source of truth for the docs pages: the sidebar/pill nav, the
 * overview card grid and the per-article "Next steps" cards all read from
 * here. They used to keep three separate copies, which had already drifted
 * apart, and adding a page meant remembering all three.
 */
export interface DocsPage {
  href: string;
  title: string;
  description: string;
  icon: typeof Download;
  iconClassName: string;
}

export const DOCS_PAGES = {
  overview: {
    href: "/docs",
    title: "Overview",
    description: "Where to start, and what's covered here.",
    icon: Cog,
    iconClassName: "text-ctp-text",
  },
  installing: {
    href: "/docs/installing",
    title: "Installing",
    description:
      "Get stellar on Linux, macOS or Windows, plus shell completions.",
    icon: Download,
    iconClassName: "text-ctp-blue",
  },
  commands: {
    href: "/docs/commands",
    title: "Commands",
    description:
      "Every stellar command with examples: apply, preview, remove and more.",
    icon: Terminal,
    iconClassName: "text-ctp-green",
  },
  "how-it-works": {
    href: "/docs/how-it-works",
    title: "How it works",
    description:
      "The theme cache, symlink vs copy mode, and automatic backups.",
    icon: Cog,
    iconClassName: "text-ctp-mauve",
  },
  troubleshooting: {
    href: "/docs/troubleshooting",
    title: "Troubleshooting",
    description: "Common errors and how to fix them.",
    icon: Bug,
    iconClassName: "text-ctp-red",
  },
  browse: {
    href: "/",
    title: "Browse themes",
    description: "Find your next prompt on the stellar hub.",
    icon: Palette,
    iconClassName: "text-ctp-peach",
  },
} satisfies Record<string, DocsPage>;

export type DocsPageKey = keyof typeof DOCS_PAGES;

/** Nav order: the overview plus every article, excluding the hub itself. */
export const DOCS_NAV_KEYS: DocsPageKey[] = [
  "overview",
  "installing",
  "commands",
  "how-it-works",
  "troubleshooting",
];

/** The overview page's card grid: every article, without the overview. */
export const DOCS_CARD_KEYS: DocsPageKey[] = [
  "installing",
  "commands",
  "how-it-works",
  "troubleshooting",
];
