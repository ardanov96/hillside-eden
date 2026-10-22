import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { type RawSearchParams, toQueryString } from "@/lib/search-params";
import { buttonVariants } from "@/components/ui/button";

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
      className="flex flex-wrap items-center justify-between gap-3 text-sm py-2"
      aria-label="Pagination booking"
    >
      <span className="text-xs text-muted-foreground">
        Halaman <strong className="text-foreground">{page}</strong> dari {pageCount} · {total} baris
      </span>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <PaginationLink
            href={buildHref(basePath, searchParams, prev)}
            disabled={page <= 1}
            label={
              <span className="flex items-center gap-1">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </span>
            }
          />
        </li>
        {sortedPages.map((p, idx) => {
          const prevP = sortedPages[idx - 1];
          const showGap = prevP !== undefined && p - prevP > 1;
          return (
            <li key={p} className="flex items-center">
              {showGap ? (
                <span aria-hidden="true" className="px-1 text-muted-foreground">
                  &hellip;
                </span>
              ) : null}
              {p === page ? (
                <span
                  aria-current="page"
                  className={
                    buttonVariants({ size: "sm", variant: "default" }) + " min-w-8 h-8 px-2.5"
                  }
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={buildHref(basePath, searchParams, p)}
                  className={
                    buttonVariants({ size: "sm", variant: "outline" }) + " min-w-8 h-8 px-2.5"
                  }
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
            label={
              <span className="flex items-center gap-1">
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            }
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
  label: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="inline-flex h-8 items-center justify-center rounded-md border border-border/50 px-2.5 text-xs text-muted-foreground/60 cursor-not-allowed"
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={buttonVariants({ size: "sm", variant: "outline" }) + " h-8 px-2.5 text-xs"}
    >
      {label}
    </Link>
  );
}
