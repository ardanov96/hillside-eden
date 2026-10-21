/**
 * Kelas Tailwind bersama untuk halaman Bookings (S2-07.2).
 * Supaya padding/border/tinggi input konsisten lintas form & filter.
 */
export const INPUT_CLASS =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none " +
  "focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";

export const TABLE_HEAD_CLASS =
  "sticky top-0 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold uppercase " +
  "tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";

export const TABLE_CELL_CLASS =
  "px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 whitespace-nowrap";

export const TABLE_ROW_CLASS =
  "border-t border-zinc-100 transition hover:bg-emerald-50/40 dark:border-zinc-800 dark:hover:bg-emerald-900/10";
