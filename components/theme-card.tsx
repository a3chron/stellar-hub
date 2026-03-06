import Image from "next/image";
import Link from "next/link";

interface ThemeCardProps {
  theme: {
    slug: string;
    name: string;
    screenshotUrl: string;
    downloads: number;
    colorMode: "dark" | "light" | "both";
    author: {
      name: string;
    };
    colorScheme: {
      name: string;
    } | null;
  };
}

export default function ThemeCard({ theme }: ThemeCardProps) {
  return (
    <Link
      href={`/${theme.author.name}/${theme.slug}`}
      className="group block bg-ctp-mantle rounded-lg border-2 border-ctp-crust"
    >
      <div className="overflow-hidden rounded-t-lg">
        <Image
          src={theme.screenshotUrl}
          alt={theme.name}
          width={600}
          height={144}
          className="w-full h-36 object-cover object-top-left"
        />
      </div>
      <div className="p-4 border-t border-t-ctp-crust flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{theme.name}</h3>
          <p className="text-sm text-ctp-subtext0">by {theme.author.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 mt-1">
          <span className="text-sm text-ctp-subtext0">
            {theme.downloads} downloads
          </span>
          <div className="flex items-center gap-1.5 text-xs text-ctp-overlay0">
            {theme.colorScheme && <span>{theme.colorScheme.name}</span>}
            {theme.colorScheme && <span>·</span>}
            <span>
              {theme.colorMode === "dark" && "Dark"}
              {theme.colorMode === "light" && "Light"}
              {theme.colorMode === "both" && "Light/Dark"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
