/**
 * Kelas Tailwind bersama untuk halaman Bookings (S2-07.2 + shadcn redesign).
 * Supaya padding/border/tinggi input konsisten lintas form & filter.
 */
export const INPUT_CLASS =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const TABLE_HEAD_CLASS =
  "h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40";

export const TABLE_CELL_CLASS = "p-4 align-middle text-sm text-foreground whitespace-nowrap";

export const TABLE_ROW_CLASS = "border-b border-border transition-colors hover:bg-muted/50";
