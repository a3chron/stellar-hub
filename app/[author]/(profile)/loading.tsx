import { Skeleton } from "@/components/skeletons/skeleton";
import { ThemeGridSkeleton } from "@/components/skeletons/theme-grid-skeleton";

// Lives in the (profile) group rather than app/[author] so it only covers the
// profile page - one level up it would also flash before every theme page,
// which has its own skeleton.
export default function AuthorLoading() {
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start gap-8 mb-12">
          <Skeleton className="w-[120px] h-[120px] rounded-full shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-10 w-56 mb-2" />
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="flex flex-wrap gap-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-40 mb-6" />
        <ThemeGridSkeleton count={6} />
      </div>
    </main>
  );
}
