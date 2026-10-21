/**
 * Form filter halaman Bookings (S2-07.2).
 *
 * - Submit memakai method GET ke /bookings, jadi tidak butuh JS.
 * - Setiap perubahan filter full reload; sesuai ekspektasi tabel admin
 *   di §7-ui-spec (mobile-first untuk form, desktop untuk tabel; ini
 *   tabel admin yang lebih cocok ke desktop).
 * - Submit kedua tombol:
 *     - "Terapkan" -> replace halaman dengan query
 *     - "Reset" -> /bookings kosong
 */
import { INPUT_CLASS } from "./ui-primitives";

export interface FilterOption {
  value: string;
  label: string;
}

export interface BookingFiltersFormProps {
  channelOptions: readonly FilterOption[];
  propertyOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  values: {
    channel?: string;
    propertyId?: string;
    status?: string;
    checkInFrom?: string;
    checkInTo?: string;
    search?: string;
  };
  /** Mengunci apakah hasil pencarian kosong agar tampilkan saran. */
  resultCount?: number;
}

export function BookingFiltersForm({
  channelOptions,
  propertyOptions,
  statusOptions,
  values,
  resultCount,
}: BookingFiltersFormProps) {
  return (
    <form
      method="get"
      action="/bookings"
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-6"
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

      <div className="space-y-1">
        <label
          htmlFor="propertyId"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Properti
        </label>
        <select
          id="propertyId"
          name="propertyId"
          defaultValue={values.propertyId ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">Semua</option>
          {propertyOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="checkInFrom"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Check-in dari
        </label>
        <input
          id="checkInFrom"
          name="checkInFrom"
          type="date"
          defaultValue={values.checkInFrom ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="checkInTo"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Check-in sampai
        </label>
        <input
          id="checkInTo"
          name="checkInTo"
          type="date"
          defaultValue={values.checkInTo ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex items-end gap-2 lg:col-span-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Terapkan
        </button>
        <a
          href="/bookings"
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
