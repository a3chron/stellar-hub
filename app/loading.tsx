import { FiltersSkeleton } from "@/components/skeletons/filters-skeleton";
import { Skeleton } from "@/components/skeletons/skeleton";
import { ThemeGridSkeleton } from "@/components/skeletons/theme-grid-skeleton";

export default function HomeLoading() {
  return (
    <main className="container mx-auto px-4 py-12">
      {/* Hero Section Skeleton */}
      <section className="mb-16 flex flex-col md:flex-row gap-16 justify-between">
        <div className="mt-10">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-6 w-80" />
          <div className="flex flex-wrap mt-8 gap-10 md:gap-6">
            <Skeleton className="h-14 w-44 rounded-xl" />
            <Skeleton className="h-14 w-44 rounded-xl" />
          </div>
        </div>
        <div className="relative z-10">
          <Skeleton className="rounded-3xl w-[600px] h-[400px]" />
        </div>
      </section>

      {/* Themes Section Skeleton */}
      <section>
        <Skeleton className="h-9 w-48 mb-6" />
        <FiltersSkeleton />
        <ThemeGridSkeleton />
      </section>
    </main>
  );
}
