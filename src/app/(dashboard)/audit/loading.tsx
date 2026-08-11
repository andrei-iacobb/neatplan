import { ListLoading, PageLoading, Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for the audit log: header, the filter card, four summary
 * tiles, then the event table.
 */
export default function Loading() {
  return (
    <div data-route-skeleton="audit" className="max-w-[1100px] mx-auto relative z-10 pb-8">
      <div className="flex justify-between items-start mb-10">
        <div className="space-y-2">
          <Skeleton className="h-4" width={120} />
          <Skeleton className="h-8" width={200} />
          <Skeleton className="h-4" width={340} />
        </div>
        <Skeleton className="h-8 rounded-lg shrink-0" width={110} />
      </div>

      {/* Date, room, cleaner and search filters */}
      <Skeleton className="h-[74px] rounded-xl mb-6" />

      <PageLoading cards={4} columns={4} header={false} className="mb-6" label="Loading audit summary" />

      <ListLoading rows={8} label="Loading audit log" />
    </div>
  )
}
