import { PageLoading, Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for equipment: header, the tabs/actions row, the filter card,
 * then the 3-column card grid.
 */
export default function Loading() {
  return (
    <div data-route-skeleton="equipment" className="max-w-[1100px] mx-auto relative z-10 pb-8 px-4">
      <div className="mb-10 space-y-2">
        <Skeleton className="h-4" width={150} />
        <Skeleton className="h-8" width={230} />
        <Skeleton className="h-4" width={330} />
      </div>

      {/* Tabs and actions row */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <Skeleton className="h-8 rounded-lg" width={110} />
        <Skeleton className="h-8 rounded-lg" width={260} />
      </div>

      {/* Search and type filter card */}
      <Skeleton className="h-[74px] rounded-xl mb-6" />

      <PageLoading cards={6} columns={3} header={false} label="Loading equipment" />
    </div>
  )
}
