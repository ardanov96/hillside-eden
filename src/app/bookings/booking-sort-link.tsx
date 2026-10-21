/**
 * Header kolom tabel dengan toggle sort (S2-07.2).
 *
 * Membangun URL yang mempertahankan filter tetapi menukar key sort.
 * - Bila kolom ini sudah jadi sort aktif -> toggle asc/desc.
 * - Bila kolom belum aktif -> aktifkan dengan default desc.
 */
import Link from "next/link";

import { type RawSearchParams, toQueryString } from "@/lib/search-params";
import type { BookingSortKey, SortDirection } from "@/server/queries/bookings";

export interface BookingSortLinkProps {
  columnKey: BookingSortKey;
  activeKey?: BookingSortKey;
  activeDir?: SortDirection;
  basePath: string;
  searchParams: RawSearchParams;
  children: React.ReactNode;
  className?: string;
}

export function BookingSortLink({
  columnKey,
  activeKey,
  activeDir,
  basePath,
  searchParams,
  children,
  className,
}: BookingSortLinkProps) {
  const isActive = activeKey === columnKey;
  const nextDir: SortDirection = isActive && activeDir === "desc" ? "asc" : "desc";
  // Sort baru selalu reset ke halaman 1; abaikan sort & page dari params.
  const next = toQueryString(searchParams);
  next.delete("sort");
  next.delete("page");
  next.set("sort", `${columnKey}:${nextDir}`);
  const finalHref = `${basePath}?${next.toString()}`;

  return (
    <Link
      href={finalHref}
      className={[
        "inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400",
        isActive ? "text-emerald-700 dark:text-emerald-300" : "",
        className,
      ].join(" ")}
      aria-sort={isActive ? (activeDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {isActive ? (
        <span aria-hidden="true" className="text-[10px]">
          {activeDir === "asc" ? "\u2191" : "\u2193"}
        </span>
      ) : (
        <span aria-hidden="true" className="text-[10px] text-zinc-400">
          {"\u2195"}
        </span>
      )}
    </Link>
  );
}
