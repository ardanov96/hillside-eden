/**
 * Bentuk "string-only" dari filter global untuk form GET tanpa JS.
 *
 * `GlobalFilter` (src/lib/filters/global-filter.ts) menyimpan `range` yang
 * sudah di-resolve untuk query database; tipe ini yang justru ditulis ke
 * hidden input dan link Reset, jadi cukup properti opsional.
 */
import type { PeriodPreset } from "@/lib/filters/global-filter";

/**
 * Parameter global yang dipertahankan saat form lokal di-submit.
 *
 * Dipakai bersama antara BookingFiltersForm dan halaman Bookings. Field
 * `propertyId`/`from`/`to` opsional; `period` opsional supaya form bisa
 * membedakan "belum ada filter global" dari "default bulan ini".
 */
export interface PreservedGlobalParams {
  propertyId?: string;
  period?: PeriodPreset;
  from?: string;
  to?: string;
}
