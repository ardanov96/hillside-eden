"use client";

/**
 * Form filter halaman Bookings (S2-07.2 + S4-01) - Client Component.
 *
 * - Submit memakai router.push dengan useTransition() untuk transisi client-side
 *   yang mulus tanpa reload otomatis/refresh layar penuh.
 * - Kunci global (propertyId + rentang tanggal) dipertahankan lewat helper
 *   sehingga filter global tidak hilang saat user mengubah filter lokal.
 * - Reset mempertahankan hanya filter global; filter lokal dikosongkan.
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.2.
 */
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Loader2, RotateCcw } from "lucide-react";

import { INPUT_CLASS } from "./ui-primitives";
import type { PreservedGlobalParams } from "./preserved-params";
import type { StayDate } from "@/lib/dates";
import { globalFilterQueryString } from "@/lib/filters/global-filter";
import { Button } from "@/components/ui/button";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(values.search ?? "");
  const [prevSearch, setPrevSearch] = useState(values.search ?? "");
  if ((values.search ?? "") !== prevSearch) {
    setPrevSearch(values.search ?? "");
    setSearch(values.search ?? "");
  }

  const channel = values.channel ?? "";
  const status = values.status ?? "";

  function applyFilter(overrides?: { search?: string; channel?: string; status?: string }) {
    const s = overrides?.search !== undefined ? overrides.search : search;
    const c = overrides?.channel !== undefined ? overrides.channel : channel;
    const st = overrides?.status !== undefined ? overrides.status : status;

    const sp = new URLSearchParams();
    if (s.trim()) sp.set("search", s.trim());
    if (c) sp.set("channel", c);
    if (st) sp.set("status", st);

    if (preserved?.propertyId) sp.set("propertyId", preserved.propertyId);
    if (preserved?.period) sp.set("period", preserved.period);
    if (preserved?.period === "custom" && preserved.from) sp.set("from", preserved.from);
    if (preserved?.period === "custom" && preserved.to) sp.set("to", preserved.to);

    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `/bookings?${qs}` : "/bookings");
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilter();
  }

  const resetHref = `/bookings${globalQ(preserved)}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 xl:grid-cols-4"
    >
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
        <label htmlFor="search" className="block text-xs font-semibold text-foreground">
          Cari kode konfirmasi
        </label>
        <input
          id="search"
          name="search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          value={channel}
          onChange={(e) => {
            applyFilter({ channel: e.target.value });
          }}
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
          value={status}
          onChange={(e) => {
            applyFilter({ status: e.target.value });
          }}
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

      <div className="flex flex-wrap items-center gap-2 pt-2 sm:col-span-2 xl:col-span-4 border-t border-border/60">
        <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 shadow-xs">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Filter className="h-3.5 w-3.5" />
          )}
          <span>{isPending ? "Menerapkan..." : "Terapkan Filter"}</span>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={resetHref} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Link>
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
