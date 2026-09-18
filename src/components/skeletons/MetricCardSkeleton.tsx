import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardSkeletonProps {
  count?: number;
  className?: string;
}

export function MetricCardSkeleton({
  count = 4,
  className = "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
}: MetricCardSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default MetricCardSkeleton;
