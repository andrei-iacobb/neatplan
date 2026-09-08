export default function FloorPlansLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse">
      <div className="mb-6 h-10 w-64 rounded-xl bg-black/10 dark:bg-white/10" />
      <div className="grid min-h-[650px] gap-4 lg:grid-cols-[250px_minmax(0,1fr)_280px]">
        <div className="rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="rounded-2xl bg-black/5 dark:bg-white/5" />
      </div>
    </div>
  )
}
