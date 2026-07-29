import { PageLoading, Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for rooms: header, the tabs/actions row, then the 3-column
 * card grid.
 */
export default function Loading() {
  return (
    <div data-route-skeleton="rooms" className="max-w-[1100px] mx-auto relative z-10 pb-8">
      <div className="mb-10 space-y-2">
        <Skeleton className="h-4" width={130} />
        <Skeleton className="h-8" width={220} />
        <Skeleton className="h-4" width={340} />
      </div>

      {/* Tabs and actions row */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <Skeleton className="h-8 rounded-lg" width={180} />
        <Skeleton className="h-8 rounded-lg" width={200} />
      </div>

      <PageLoading cards={8} columns={3} header={false} label="Loading rooms" />
    </div>
  )
}
