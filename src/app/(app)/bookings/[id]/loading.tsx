/**
 * Loading skeleton untuk halaman detail booking (`/bookings/[id]`).
 */
export default function BookingDetailLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="h-3.5 w-40 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="h-6 w-20 rounded-md bg-slate-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-7 w-48 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-72 rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 xl:col-span-2 animate-pulse" />
        <div className="h-72 rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse" />
      </div>
      <div className="h-48 rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 animate-pulse" />
    </div>
  );
}
