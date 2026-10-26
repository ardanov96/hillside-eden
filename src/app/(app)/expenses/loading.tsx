/**
 * Loading Skeleton untuk halaman Pengeluaran (`/expenses`).
 *
 * Mengaktifkan streaming instan pada saat user membuka menu pengeluaran.
 */
export default function ExpensesLoading() {
  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div className="space-y-2">
          <div className="h-8 w-60 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3.5 w-96 max-w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-9 w-36 rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </header>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2"
          >
            <div className="h-4 w-28 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-7 w-36 rounded bg-slate-200 dark:bg-zinc-750 animate-pulse" />
            <div className="h-3 w-20 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filter Form Skeleton */}
      <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="h-11 border-b border-slate-100 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-850" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-slate-100 p-4 last:border-0 dark:border-zinc-800"
          >
            <div className="h-4 w-20 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-4 w-28 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-4 w-32 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            <div className="h-4 w-20 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
