import { Skeleton } from "@/components/skeletons/skeleton";

// Name, slug, description, dependencies, min version - roughly the wizard's
// first step.
const FIELD_HEIGHTS = ["h-10", "h-10", "h-24", "h-20", "h-10"];

export default function UploadLoading() {
  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-full max-w-sm mb-8" />
          {/* The stepper's bars */}
          <div className="flex gap-2 mb-12">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static placeholders with no state or reordering
              <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
            ))}
          </div>
          <div className="space-y-6">
            {FIELD_HEIGHTS.map((height, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static placeholders with no state or reordering
              <div key={i}>
                <Skeleton className="h-4 w-32 mb-1.5" />
                <Skeleton className={`${height} w-full rounded-lg`} />
              </div>
            ))}
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}
