import { PageLoading, Skeleton } from '@/components/ui/loading'

/**
 * Route fallback for the cleaner dashboard. This is the one most people hit on
 * a phone, so it carries no page JS of its own and paints on tap.
 *
 * Matches the real page: 7xl container with its own horizontal padding, the
 * four-up stat row, the search/filter card, then the h-64 room card grid.
 */
export default function Loading() {
  return (
    <div data-route-skeleton="clean" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8" width={280} />
        <Skeleton className="h-4" width={300} />
      </div>

      <PageLoading cards={4} columns={4} header={false} className="mb-8" label="Loading your summary" />

      {/* Search, filters and view toggle */}
      <Skeleton className="h-[132px] rounded-lg mb-8" />

      <section role="status" aria-busy="true" aria-label="Loading your rooms">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-5" width={150} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
        <span className="sr-only">Loading your rooms</span>
      </section>
    </div>
  )
}
