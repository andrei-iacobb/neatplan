import { Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for a single room's clean sheet. The real page is a narrow
 * single column: back link and room identity, a thin controls row, then the
 * stacked schedule cards.
 */
export default function Loading() {
  return (
    <div
      data-route-skeleton="clean-room"
      role="status"
      aria-busy="true"
      aria-label="Loading room"
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Back link and room identity */}
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-6" width={220} />
          <Skeleton className="h-4" width={180} />
        </div>
      </div>

      {/* Started-at line and Reset All */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-4" width={150} />
        <Skeleton className="h-9 rounded-lg" width={100} />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>

      <span className="sr-only">Loading room</span>
    </div>
  )
}
