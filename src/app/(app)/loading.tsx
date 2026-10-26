/**
 * Loading Skeleton untuk route group `(app)` (Dashboard Ringkasan Eksekutif).
 *
 * Mengaktifkan React Streaming SSR pada Next.js App Router:
 * - Shell aplikasi (sidebar, navbar, logo) ter-render instan (<50ms).
 * - Pengguna langsung melihat visual placeholder elegan tanpa blank screen / hanging.
 * - Data aktual otomatis disuntikkan secara mulus saat query database selesai.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner & Action Buttons Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-56 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-5 w-24 rounded-full bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-3.5 w-80 max-w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-2.5">
          <div className="h-9 w-32 rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-9 w-32 rounded-xl bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>

      {/* 2. Top Row: 6 KPI Cards Skeletons (Matching Responsive Grid) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 flex flex-col justify-between h-[138px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-12 rounded-full bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            </div>
            <div className="flex items-end justify-between py-1">
              <div className="h-7 w-36 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse" />
              <div className="h-8 w-16 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            </div>
            <div className="h-3 w-28 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
        ))}
      </div>

      {/* 3. Middle Row: Chart & Analytics Skeletons */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="col-span-12 xl:col-span-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-48 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-64 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-56 w-full rounded-xl bg-slate-50 dark:bg-zinc-800/40 animate-pulse" />
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-44 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="space-y-3 py-4">
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-8 w-full rounded-xl bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-80 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3 w-44 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-40 w-full rounded-xl bg-slate-50 dark:bg-zinc-850 animate-pulse" />
          <div className="h-4 w-28 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>
      </div>

      {/* 4. Bottom Row: Channel Breakdown & Recent Bookings Table Skeleton */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="col-span-12 xl:col-span-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-72 flex flex-col justify-between">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
          <div className="space-y-2 py-2">
            <div className="h-6 w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            <div className="h-6 w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
            <div className="h-6 w-full rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-3 w-32 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>

        <div className="col-span-12 xl:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-72 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="h-4 w-44 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-3.5 w-20 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="space-y-2 py-2">
            <div className="h-10 w-full rounded-xl bg-slate-50 dark:bg-zinc-850 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-slate-50 dark:bg-zinc-850 animate-pulse" />
            <div className="h-10 w-full rounded-xl bg-slate-50 dark:bg-zinc-850 animate-pulse" />
          </div>
          <div className="h-3 w-28 rounded bg-slate-100 dark:bg-zinc-850 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
