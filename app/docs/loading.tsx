import { Skeleton } from "@/components/skeletons/skeleton";

// Rendered inside the docs layout, so the nav and table of contents stay put
// and only the article area is stood in for.
export default function DocsLoading() {
  return (
    <div>
      <Skeleton className="h-10 w-64 mb-6" />
      {[0, 1, 2].map((block) => (
        <div key={block} className="mb-10 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-24 w-full rounded-lg mt-4" />
        </div>
      ))}
    </div>
  );
}
