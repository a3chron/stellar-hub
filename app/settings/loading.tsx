import { Skeleton } from "@/components/skeletons/skeleton";

function SectionSkeleton({ fields }: { fields: number }) {
  return (
    <div className="bg-ctp-mantle rounded-lg border border-ctp-surface0 p-8">
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-4 w-full max-w-md mb-6" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static placeholders with no state or reordering
          <div key={i}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <main className="bg-ctp-base">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-44 mb-2" />
          <Skeleton className="h-5 w-72 mb-12" />
          <div className="space-y-12">
            {/* Profile, username, your themes */}
            <SectionSkeleton fields={3} />
            <SectionSkeleton fields={1} />
            <SectionSkeleton fields={2} />
          </div>
        </div>
      </div>
    </main>
  );
}
