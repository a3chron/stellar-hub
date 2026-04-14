import { ThemeCardSkeleton } from "./theme-card-skeleton";

interface ThemeGridSkeletonProps {
  count?: number;
}

export function ThemeGridSkeleton({ count = 12 }: ThemeGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static placeholders with no state or reordering
        <ThemeCardSkeleton key={i} />
      ))}
    </div>
  );
}
