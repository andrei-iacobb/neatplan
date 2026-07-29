import { ListLoading, Skeleton } from '@/components/ui/loading'

/** Route fallback for the users table. Rows, not cards. */
export default function Loading() {
  return (
    <div data-route-skeleton="users" className="max-w-[1100px] mx-auto relative z-10 pb-8">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4" width={110} />
          <Skeleton className="h-8" width={180} />
          <Skeleton className="h-4" width={320} />
        </div>
        <Skeleton className="h-9 rounded-lg flex-shrink-0" width={110} />
      </div>

      <ListLoading rows={8} label="Loading users" />
    </div>
  )
}
