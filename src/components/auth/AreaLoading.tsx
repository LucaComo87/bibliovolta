import { Skeleton } from "@/components/ui/Skeleton";

export function AreaLoading() {
  return (
    <div className="space-y-4" aria-label="Caricamento">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
