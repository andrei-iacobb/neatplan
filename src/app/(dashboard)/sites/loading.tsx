import { PageLoading, Skeleton } from '@/components/ui/loading'

/** Route fallback for sites. The real grid is 2 columns, not 3. */
export default function Loading() {
  return (
    <div data-route-skeleton="sites" className="max-w-[1100px] mx-auto relative z-10 pb-8">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4" width={100} />
          <Skeleton className="h-8" width={170} />
          <Skeleton className="h-4" width={310} />
        </div>
        <Skeleton className="h-9 rounded-lg flex-shrink-0" width={100} />
      </div>

      <PageLoading cards={4} columns={2} header={false} label="Loading sites" />
    </div>
  )
}
