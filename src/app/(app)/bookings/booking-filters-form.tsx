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

import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1.5 lg:col-span-2">
        <label htmlFor="search" className="block text-xs font-semibold text-foreground">
          Cari kode konfirmasi
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={values.search ?? ""}
          placeholder="Misal: HMABC123..."
          maxLength={64}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="channel" className="block text-xs font-semibold text-foreground">
          Saluran (OTA)
        </label>
        <select
          id="channel"
          name="channel"
          defaultValue={values.channel ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">Semua Saluran</option>
          {channelOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="status" className="block text-xs font-semibold text-foreground">
          Status Booking
        </label>
        <select
          id="status"
          name="status"
          defaultValue={values.status ?? ""}
          className={INPUT_CLASS}
        >
          <option value="">Semua Status</option>
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

      <div className="flex items-center gap-2 pt-2 sm:col-span-2 lg:col-span-4 border-t border-border/60">
        <Button type="submit" size="sm" className="gap-1.5 shadow-xs">
          <Filter className="h-3.5 w-3.5" />
          <span>Terapkan Filter</span>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={resetHref} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </a>
        </Button>
        {typeof resultCount === "number" ? (
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            Ditemukan <strong className="text-foreground">{resultCount}</strong> hasil
          </span>
        ) : null}
      </div>
    </form>
  );
}
