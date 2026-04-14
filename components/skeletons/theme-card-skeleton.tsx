import { Skeleton } from "./skeleton";

export function ThemeCardSkeleton() {
  return (
    <div className="bg-ctp-mantle rounded-lg border-2 border-ctp-crust">
      {/* Image placeholder - matches h-36 from ThemeCard */}
      <Skeleton className="rounded-t-lg rounded-b-none h-36" />
      {/* Content area - matches p-4 from ThemeCard */}
      <div className="p-4 border-t border-t-ctp-crust flex justify-between items-start">
        <div className="flex flex-col gap-2">
          {/* Theme name */}
          <Skeleton className="h-5 w-32" />
          {/* Author name */}
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col items-end gap-2 mt-1">
          {/* Downloads count */}
          <Skeleton className="h-4 w-24" />
          {/* Color scheme info */}
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
