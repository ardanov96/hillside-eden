/**
 * Orchestrator daftar Bookings (S2-07.2 + S4-01).
 *
 * Server component yang:
 * 1. Memvalidasi searchParams dengan Zod.
 *    - Filter lokal (channel/status/search/sort/page) via schema lokal.
 *    - Filter global (propertyId + rentang tanggal) via
 *      src/lib/filters/global-filter.ts.
 * 2. Memuat baris booking.
 * 3. Merakit filter (lokal + preserved global), tabel, dan pagination.
 *
 * Filter global bar di layout (atas) kini memiliki dropdown properti
 * dan rentang tanggal; form lokal di sini menangani OTA, status,
 * pencarian kode konfirmasi. Hidden inputs menjaga filter global
 * agar tidak hilang saat submit.
 */
import Link from "next/link";

import {
  safeParseBookingListSearch,
  BOOKING_CHANNEL_VALUES,
  BOOKING_STATUS_VALUES,
} from "@/lib/forms/booking-list-search-schema";
import { parseGlobalFilter } from "@/lib/filters/global-filter";
import { todayInWITA } from "@/lib/dates";
import { getBookings } from "@/server/queries/bookings";

import { BookingFiltersForm } from "./booking-filters-form";
import { BookingPagination } from "./booking-pagination";
import { BookingTable } from "./booking-table";

const CHANNEL_LABEL: Record<(typeof BOOKING_CHANNEL_VALUES)[number], string> = {
  AIRBNB: "Airbnb",
  TIKET_COM: "Tiket.com",
  TRAVELOKA: "Traveloka",
  EXPEDIA: "Expedia",
  AGODA: "Agoda",
  BOOKING_COM: "Booking.com",
  DIRECT: "Direct",
  MANUAL: "Manual",
};

const STATUS_LABEL: Record<(typeof BOOKING_STATUS_VALUES)[number], string> = {
  PENDING: "Menunggu",
  CONFIRMED: "Dikonfirmasi",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "Tidak hadir",
};

export interface BookingListProps {
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export async function BookingList({ organizationId, searchParams }: BookingListProps) {
  const parsed = safeParseBookingListSearch(searchParams);
  if (!parsed.ok) {
    return <EmptyState title="Parameter filter tidak valid" message={parsed.issues.join("; ")} />;
  }
  const q = parsed.data;

  // Filter global (properti + rentang tanggal) dipisah dari filter lokal.
  const gf = parseGlobalFilter(searchParams, todayInWITA());

  const list = await getBookings({
    organizationId,
    filters: {
      channel: q.channel ?? null,
      propertyId: gf.propertyId ?? null,
      status: q.status ?? null,
      checkInFrom: gf.range?.start ?? null,
      checkInTo: gf.range?.end ?? null,
      search: q.search ?? null,
    },
    sort: q.sort,
    page: q.page,
    pageSize: q.pageSize,
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Daftar Booking
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Baris Booking dari seluruh OTA, manual, dan direct. Klik baris untuk membuka detail.
          </p>
        </div>
        <Link
          href="/bookings/new"
          className="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          + Tambah booking manual
        </Link>
      </header>

      <BookingFiltersForm
        channelOptions={BOOKING_CHANNEL_VALUES.map((v) => ({
          value: v,
          label: CHANNEL_LABEL[v],
        }))}
        statusOptions={BOOKING_STATUS_VALUES.map((v) => ({
          value: v,
          label: STATUS_LABEL[v],
        }))}
        values={{
          channel: q.channel,
          status: q.status,
          search: q.search,
        }}
        preserved={gf}
        resultCount={list.total}
      />

      <BookingTable
        rows={list.rows}
        sort={q.sort}
        basePath="/bookings"
        searchParams={searchParams}
      />

      <BookingPagination
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        basePath="/bookings"
        searchParams={searchParams}
      />
    </section>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
    </section>
  );
}
