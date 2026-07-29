import { ListLoading, Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for the cleaning schedule. The real page stacks its schedules
 * as rows inside one panel, so this is a list rather than a grid.
 */
export default function Loading() {
  return (
    <div data-route-skeleton="schedule" className="max-w-[1100px] mx-auto relative z-10 pb-8">
      <div className="mb-10 space-y-3">
        <Skeleton className="h-4" width={140} />
        <Skeleton className="h-8" width={260} />
        <Skeleton className="h-4" width={380} />
      </div>
      <ListLoading rows={6} label="Loading schedules" />
    </div>
  )
}
