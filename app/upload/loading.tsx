import { Skeleton } from "@/components/skeletons/skeleton";

// Name, slug, description, mode/scheme, group, min version, screenshot,
// config and dependencies - roughly the upload form's field stack.
const FIELD_HEIGHTS = [
  "h-10",
  "h-10",
  "h-24",
  "h-10",
  "h-10",
  "h-10",
  "h-12",
  "h-48",
  "h-20",
];

export default function UploadLoading() {
  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-full max-w-sm mb-8" />
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
