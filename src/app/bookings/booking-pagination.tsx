/**
 * Pagination link halaman Bookings (S2-07.2).
 *
 * Mempertahankan query string saat berpindah halaman; reset ke halaman
 * 1 saat pengubahan sort/filter (handler di komponen pemanggil).
 */
import Link from "next/link";

import { type RawSearchParams, toQueryString } from "@/lib/search-params";

export interface BookingPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  searchParams: RawSearchParams;
}

function buildHref(basePath: string, params: RawSearchParams, page: number): string {
  const sp = toQueryString(params);
  if (page <= 1) sp.delete("page");
  else sp.set("page", String(page));
  const q = sp.toString();
  return q.length > 0 ? `${basePath}?${q}` : basePath;
}

export function BookingPagination({
  page,
  pageCount,
  total,
  basePath,
  searchParams,
}: BookingPaginationProps) {
  if (total === 0) return null;
  // Tampilkan: first / prev / window / next / last. Window = current +/-1.
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  const pages = new Set<number>([1, pageCount, prev, page, next]);
  const sortedPages = Array.from(pages)
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label="Pagination booking"
    >
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Halaman {page} dari {pageCount} · {total} baris
      </span>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <PaginationLink
            href={buildHref(basePath, searchParams, prev)}
            disabled={page <= 1}
            label="Sebelumnya"
          />
        </li>
        {sortedPages.map((p, idx) => {
          const prevP = sortedPages[idx - 1];
          const showGap = prevP !== undefined && p - prevP > 1;
          return (
            <li key={p} className="flex items-center">
              {showGap ? (
                <span aria-hidden="true" className="px-1 text-zinc-400">
                  &hellip;
                </span>
              ) : null}
              {p === page ? (
                <span
                  aria-current="page"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={buildHref(basePath, searchParams, p)}
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {p}
                </Link>
              )}
            </li>
          );
        })}
        <li>
          <PaginationLink
            href={buildHref(basePath, searchParams, next)}
            disabled={page >= pageCount}
            label="Berikutnya"
          />
        </li>
      </ul>
    </nav>
  );
}

function PaginationLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-400 dark:border-zinc-800"
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {label}
    </Link>
  );
}
