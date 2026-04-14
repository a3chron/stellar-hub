import { Skeleton } from "./skeleton";

export function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      {/* Sort Options */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-12 w-36 rounded-xl" />
        <Skeleton className="h-12 w-20 rounded-xl" />
        <Skeleton className="h-12 w-24 rounded-xl" />
      </div>

      {/* Right-side filters */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Color Mode Filter */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-20 ml-1" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-12 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Color Scheme Filter */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-24 ml-1" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
