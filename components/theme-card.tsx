import Image from "next/image";
import Link from "next/link";

interface ThemeCardProps {
  theme: {
    slug: string;
    name: string;
    screenshotUrl: string;
    downloads: number;
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
      href={`/themes/${theme.author.name}/${theme.slug}`}
      className="group block bg-ctp-mantle rounded-lg border border-ctp-crust"
    >
      <div className="aspect-video overflow-hidden rounded-t-lg">
        <Image
          src={theme.screenshotUrl}
          alt={theme.name}
          width={600}
          height={400}
          className="w-full h-full object-cover group-hover:scale-105 duration-300"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg">{theme.name}</h3>
        <p className="text-sm text-ctp-subtext0">by {theme.author.name}</p>
        <div className="flex items-center gap-2 mt-2 text-sm text-ctp-subtext0">
          <span>{theme.downloads} downloads</span>
          {theme.colorScheme && <span>• {theme.colorScheme.name}</span>}
        </div>
      </div>
    </Link>
  );
}
