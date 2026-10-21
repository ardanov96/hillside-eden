/**
 * Form filter halaman Bookings (S2-07.2 + S4-01).
 *
 * - Submit memakai method GET ke `/bookings`, jadi tidak butuh JS.
 * - Setiap perubahan filter full reload; sesuai ekspektasi tabel admin
 *   di §7-ui-spec (mobile-first untuk form, desktop untuk tabel; ini
 *   tabel admin yang lebih cocok ke desktop).
 * - Kunci global (propertyId + rentang tanggal) dipertahankan lewat
 *   hidden inputs sehingga filter global tidak hilang saat user mengubah
 *   filter lokal.
 * - Reset mempertahankan hanya filter global; filter lokal dikosongkan.
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.2.
 */
import { INPUT_CLASS } from "./ui-primitives";
import type { PreservedGlobalParams } from "./preserved-params";
import type { StayDate } from "@/lib/dates";
import { globalFilterQueryString } from "@/lib/filters/global-filter";

export interface FilterOption {
  value: string;
  label: string;
}

export interface BookingFiltersFormProps {
  channelOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  values: {
    channel?: string;
    status?: string;
    search?: string;
  };
  /** Nilai global filter yang sedang aktif, untuk hidden inputs dan reset link. */
  preserved?: PreservedGlobalParams;
  /** Mengunci apakah hasil pencarian kosong agar tampilkan saran. */
  resultCount?: number;
}

/**
 * Query string hanya berisi filter global, untuk link Reset. Memakai helper
 * yang sama dengan bilah filter global supaya aturannya tidak berbeda.
 */
function globalQ(sp: PreservedGlobalParams | undefined): string {
  if (!sp) return "";
  return globalFilterQueryString({
    ...(sp.propertyId ? { propertyId: sp.propertyId } : {}),
    period: sp.period ?? "this_month",
    ...(sp.from ? { from: sp.from as StayDate } : {}),
    ...(sp.to ? { to: sp.to as StayDate } : {}),
  });
}

export function BookingFiltersForm({
  channelOptions,
  statusOptions,
  values,
  preserved,
  resultCount,
}: BookingFiltersFormProps) {
  const resetHref = `/bookings${globalQ(preserved)}`;
  return (
    <form
      method="get"
      action="/bookings"
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1 lg:col-span-2">
        <label
          htmlFor="search"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Cari kode konfirmasi
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={values.search ?? ""}
          placeholder="HMABC123"
          maxLength={64}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="channel"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          OTA
        </label>
        <select
          id="channel"
          name="channel"
          defaultValue={values.channel ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">Semua</option>
          {channelOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="status"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={values.status ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">Semua</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {preserved?.propertyId ? (
        <input type="hidden" name="propertyId" value={preserved.propertyId} />
      ) : null}
      {preserved?.period ? <input type="hidden" name="period" value={preserved.period} /> : null}
      {preserved?.period === "custom" && preserved.from ? (
        <input type="hidden" name="from" value={preserved.from} />
      ) : null}
      {preserved?.period === "custom" && preserved.to ? (
        <input type="hidden" name="to" value={preserved.to} />
      ) : null}

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Terapkan
        </button>
        <a
          href={resetHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Reset
        </a>
        {typeof resultCount === "number" ? (
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            {resultCount} hasil
          </span>
        ) : null}
      </div>
    </form>
  );
}
