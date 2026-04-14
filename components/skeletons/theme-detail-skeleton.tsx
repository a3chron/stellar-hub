import { Skeleton } from "./skeleton";

export function ThemeDetailSkeleton() {
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <Skeleton className="h-10 w-64 mb-2" />
        {/* Author and downloads */}
        <Skeleton className="h-5 w-48 mb-8" />

        {/* Screenshot */}
        <Skeleton className="w-full h-60 rounded-lg mb-8" />

        {/* Apply command */}
        <Skeleton className="h-14 w-full max-w-md rounded-xl mb-8" />

        {/* Description */}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Versions section */}
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-20 w-full max-w-lg rounded-r-xl" />
          <Skeleton className="h-16 w-full max-w-lg rounded-r-xl" />
        </div>
      </div>
    </main>
  );
}
