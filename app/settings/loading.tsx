import { Skeleton } from "@/components/skeletons/skeleton";

function SectionSkeleton({
  children,
  action = false,
}: {
  children: React.ReactNode;
  action?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ctp-surface0 bg-ctp-mantle p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-2 h-7 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {action && (
          <Skeleton className="hidden h-10 w-36 rounded-lg sm:block" />
        )}
      </div>
      {children}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ctp-surface0 bg-ctp-base p-3 sm:flex-row sm:items-center sm:p-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-5 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg sm:w-28" />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <main className="bg-ctp-base">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header: avatar, title and name, public profile link */}
        <div className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
          <Skeleton className="size-12 shrink-0 rounded-full sm:size-16" />
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-8 w-36" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-32 shrink-0 rounded-lg sm:w-44" />
        </div>

        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          {/* Section nav: chips below lg, a sidebar from lg */}
          <div className="flex gap-2 overflow-hidden lg:flex-col lg:gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static placeholders with no state or reordering
                key={i}
                className="h-8 w-24 shrink-0 rounded-full lg:h-9 lg:w-full lg:rounded-lg"
              />
            ))}
          </div>

          <div className="mt-6 min-w-0 space-y-6 lg:mt-0">
            {/* Profile */}
            <SectionSkeleton>
              <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8">
                <div className="flex items-center gap-4 md:flex-col md:items-start">
                  <Skeleton className="size-20 shrink-0 rounded-full md:size-28" />
                  <Skeleton className="h-10 w-36 rounded-lg" />
                </div>
                <div className="space-y-5">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-11 w-full rounded-lg" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </div>
                </div>
              </div>
            </SectionSkeleton>

            {/* Username */}
            <SectionSkeleton>
              <Skeleton className="h-11 w-full max-w-md rounded-lg" />
            </SectionSkeleton>

            {/* Drafts */}
            <SectionSkeleton>
              <RowSkeleton />
            </SectionSkeleton>

            {/* Themes */}
            <SectionSkeleton action>
              <div className="flex flex-col gap-4 rounded-xl border border-ctp-surface0 bg-ctp-base p-3 sm:flex-row sm:gap-5 sm:p-4">
                <Skeleton className="aspect-video w-full shrink-0 rounded-lg sm:aspect-[16/10] sm:w-44" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-2 h-6 w-48" />
                  <Skeleton className="mb-3 h-4 w-32" />
                  <Skeleton className="mb-4 h-4 w-full max-w-sm" />
                  <div className="flex gap-2">
                    <Skeleton className="h-10 flex-1 rounded-lg sm:w-32 sm:flex-none" />
                    <Skeleton className="h-10 flex-1 rounded-lg sm:w-32 sm:flex-none" />
                  </div>
                </div>
              </div>
            </SectionSkeleton>

            {/* CLI logins */}
            <SectionSkeleton>
              <RowSkeleton />
            </SectionSkeleton>
          </div>
        </div>
      </div>
    </main>
  );
}
