/**
 * Tabel daftar Bookings (S2-07.2).
 *
 * Sumber kebenaran tampilan: docs/07-ui-spec.md §3.2 (Tabel dengan filter,
 * pencarian kode konfirmasi, panel detail saat baris diklik).
 *
 * Catatan sementara:
 * - Klik baris membuka panel detail (S2-07.3) via <BookingDetailDrawer>.
 * - Untuk sekarang baris adalah Link ke /bookings/[id] sehingga tetap
 *   dapat diketik tanpa JS. Drawer interaktif menyusul.
 */
import Link from "next/link";
import type { CommissionBasis } from "@prisma/client";

import { ChannelChip } from "./booking-chips";
import { StatusBadge, DataStatusBadge } from "@/components/badges";
import { TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_ROW_CLASS } from "./ui-primitives";
import { BookingSortLink } from "./booking-sort-link";
import { formatCurrency, formatDateShort } from "@/lib/format-id";
import type { BookingRow, BookingSort } from "@/server/queries/bookings";
import type { RawSearchParams } from "@/lib/search-params";

export interface BookingTableProps {
  rows: readonly BookingRow[];
  sort?: BookingSort;
  basePath: string;
  searchParams: RawSearchParams;
}

export function BookingTable({ rows, sort, basePath, searchParams }: BookingTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              OTA
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Kode
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Properti
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Listing
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              <BookingSortLink
                columnKey="checkIn"
                activeKey={sort?.key}
                activeDir={sort?.dir}
                basePath={basePath}
                searchParams={searchParams}
              >
                Check-in
              </BookingSortLink>
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Malam
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Status
            </th>
            <th scope="col" className={`${TABLE_HEAD_CLASS} text-right`}>
              <BookingSortLink
                columnKey="grossAmount"
                activeKey={sort?.key}
                activeDir={sort?.dir}
                basePath={basePath}
                searchParams={searchParams}
                className="justify-end"
              >
                Nilai booking (gross)
              </BookingSortLink>
            </th>
            <th scope="col" className={`${TABLE_HEAD_CLASS} text-right`}>
              Pendapatan bersih
            </th>
            <th scope="col" className={TABLE_HEAD_CLASS}>
              Status data
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className="px-3 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
              >
                Belum ada booking dengan filter saat ini.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <BookingRowComponent
                key={r.id}
                row={r}
                searchParams={searchParams}
                basePath={basePath}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function BookingRowComponent({
  row: r,
}: {
  row: BookingRow;
  searchParams: RawSearchParams;
  basePath: string;
}) {
  const grossLabel = formatCurrency(r.grossAmount, r.currency as "IDR" | "USD");
  const netLabel =
    r.netAmount !== null ? formatCurrency(r.netAmount, r.currency as "IDR" | "USD") : "-";
  return (
    <tr className={TABLE_ROW_CLASS}>
      <td className={TABLE_CELL_CLASS}>
        <Link
          href={`/bookings/${r.id}`}
          className="-m-3 inline-flex items-center gap-2 rounded-md p-0 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <ChannelChip channel={r.channel} />
        </Link>
      </td>
      <td className={`${TABLE_CELL_CLASS} font-mono text-xs`}>
        <Link
          href={`/bookings/${r.id}`}
          className="text-zinc-700 hover:underline dark:text-zinc-200"
        >
          {r.externalId}
        </Link>
      </td>
      <td className={TABLE_CELL_CLASS}>{r.propertyName}</td>
      <td className={TABLE_CELL_CLASS}>{r.listingName}</td>
      <td className={TABLE_CELL_CLASS}>{formatDateShort(r.checkIn)}</td>
      <td className={`${TABLE_CELL_CLASS} text-right tabular-nums`}>{r.nights}</td>
      <td className={TABLE_CELL_CLASS}>
        <StatusBadge status={r.status} />
      </td>
      <td className={`${TABLE_CELL_CLASS} text-right tabular-nums`}>{grossLabel}</td>
      <td className={`${TABLE_CELL_CLASS} text-right tabular-nums`}>{netLabel}</td>
      <td className={TABLE_CELL_CLASS}>
        <DataStatusBadge
          commissionAmount={r.commissionAmount}
          commissionRate={r.commissionRate}
          commissionBasis={r.commissionBasis as CommissionBasis | null}
        />
      </td>
    </tr>
  );
}
