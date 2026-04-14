interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-ctp-surface0 rounded ${className}`}
      aria-hidden="true"
    />
  );
}
