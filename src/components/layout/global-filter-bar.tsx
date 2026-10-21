"use client";
/**
 * Bilah filter global (S4-01) - Client Component.
 *
 * Mengapa client? Komponen ini harus mempertahankan parameter milik halaman
 * (mis. `channel`, `status`, `page`, `sort` di /bookings) saat user mengubah
 * filter global, lalu menavigasi tanpa full reload. Satu-satunya sumber
 * kebenaran tetap query string URL (lihat docs/DECISIONS.md).
 *
 * Nilai yang tampil dibaca dari `useSearchParams()`, bukan dari prop, supaya
 * komponen tetap sinkron setelah navigasi sisi-klien dan tidak perlu
 *diteruskan dari layout (Next.js 15 tidak memberi `searchParams` ke layout).
 */
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  PERIOD_LABEL,
  PERIOD_PRESETS,
  mergeKeepingNonGlobal,
  parseGlobalFilterSelection,
  serializeParams,
  type GlobalFilterKey,
  type PeriodPreset,
} from "@/lib/filters/global-filter";

const CONTROL =
  "h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const LABEL = "text-xs font-medium text-zinc-700 dark:text-zinc-300";

export interface PropertyOption {
  id: string;
  name: string;
}

export interface GlobalFilterBarProps {
  properties: readonly PropertyOption[];
}

export function GlobalFilterBar({ properties }: GlobalFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = Object.fromEntries(searchParams.entries());
  const { propertyId, period, from, to } = parseGlobalFilterSelection(current);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const nextPeriod = (fd.get("period") as PeriodPreset | null) ?? "this_month";

    // String kosong berarti hapus kunci (dropdown "Semua properti").
    const updates: Partial<Record<GlobalFilterKey, string>> = {
      propertyId: (fd.get("propertyId") as string | null) ?? "",
      period: nextPeriod,
    };
    if (nextPeriod === "custom") {
      updates.from = (fd.get("from") as string | null) ?? "";
      updates.to = (fd.get("to") as string | null) ?? "";
    }

    const merged = mergeKeepingNonGlobal(current, updates);
    router.push(`${pathname}${serializeParams(merged)}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Filter global: properti dan periode"
    >
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <label htmlFor="global-property" className={LABEL}>
          Properti
        </label>
        <select
          id="global-property"
          name="propertyId"
          defaultValue={propertyId ?? ""}
          className={CONTROL}
        >
          <option value="">Semua properti</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[150px] flex-col gap-1">
        <label htmlFor="global-period" className={LABEL}>
          Periode
        </label>
        <select id="global-period" name="period" defaultValue={period} className={CONTROL}>
          {PERIOD_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {period === "custom" ? (
        <>
          <div className="flex min-w-[140px] flex-col gap-1">
            <label htmlFor="global-from" className={LABEL}>
              Dari
            </label>
            <input
              id="global-from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className={CONTROL}
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-1">
            <label htmlFor="global-to" className={LABEL}>
              Sampai
            </label>
            <input
              id="global-to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className={CONTROL}
            />
          </div>
        </>
      ) : null}

      <button
        type="submit"
        className="ml-auto inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        Terapkan
      </button>
    </form>
  );
}
