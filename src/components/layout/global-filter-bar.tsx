"use client";
/**
 * Bilah filter global (S4-01 + shadcn redesign) - Client Component.
 *
 * Mengontrol filter properti, saluran OTA, dan periode (bulan ini, bulan lalu, dll.)
 * yang berlaku melintasi seluruh halaman dashboard.
 */
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Filter, Globe } from "lucide-react";

import {
  CHANNEL_PRESETS,
  PERIOD_LABEL,
  PERIOD_PRESETS,
  mergeKeepingNonGlobal,
  parseGlobalFilterSelection,
  serializeParams,
  type GlobalFilterKey,
  type PeriodPreset,
} from "@/lib/filters/global-filter";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

export interface PropertyOption {
  id: string;
  name: string;
}

export interface GlobalFilterBarProps {
  properties: readonly PropertyOption[];
  className?: string;
  isMobile?: boolean;
  onApplied?: () => void;
}

export function GlobalFilterBar({
  properties,
  className,
  isMobile = false,
  onApplied,
}: GlobalFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = Object.fromEntries(searchParams.entries());
  const { propertyId, channel, period, from, to } = parseGlobalFilterSelection(current);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const nextPeriod = (fd.get("period") as PeriodPreset | null) ?? "this_month";

    const updates: Partial<Record<GlobalFilterKey, string>> = {
      propertyId: (fd.get("propertyId") as string | null) ?? "",
      channel: (fd.get("channel") as string | null) ?? "",
      period: nextPeriod,
    };
    if (nextPeriod === "custom") {
      updates.from = (fd.get("from") as string | null) ?? "";
      updates.to = (fd.get("to") as string | null) ?? "";
    }

    const merged = mergeKeepingNonGlobal(current, updates);
    router.push(`${pathname}${serializeParams(merged)}`);
    onApplied?.();
  }

  if (isMobile) {
    return (
      <form onSubmit={onSubmit} className={cn("space-y-3", className)}>
        {/* Properti Mobile */}
        <div className="space-y-1">
          <label
            htmlFor="global-property-m"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>Pilih Properti</span>
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-zinc-800 dark:bg-zinc-850">
            <select
              id="global-property-m"
              name="propertyId"
              defaultValue={propertyId ?? ""}
              className="w-full cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="">Semua Properti (Portofolio)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Saluran / OTA Mobile */}
        <div className="space-y-1">
          <label
            htmlFor="global-channel-m"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span>Pilih Saluran / OTA</span>
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-zinc-800 dark:bg-zinc-850">
            <select
              id="global-channel-m"
              name="channel"
              defaultValue={channel ?? ""}
              className="w-full cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="">Semua Saluran (OTA)</option>
              {CHANNEL_PRESETS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Periode Mobile */}
        <div className="space-y-1">
          <label
            htmlFor="global-period-m"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span>Pilih Periode</span>
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-zinc-800 dark:bg-zinc-850">
            <select
              id="global-period-m"
              name="period"
              defaultValue={period}
              className="w-full cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {period === "custom" ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Mulai:</span>
              <input
                name="from"
                type="date"
                defaultValue={from ?? ""}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-foreground dark:border-zinc-800 dark:bg-zinc-800"
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Sampai:</span>
              <input
                name="to"
                type="date"
                defaultValue={to ?? ""}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-foreground dark:border-zinc-800 dark:bg-zinc-800"
              />
            </div>
          </div>
        ) : null}

        <Button type="submit" className="w-full h-9 gap-1.5 font-semibold shadow-xs mt-1">
          <Filter className="h-4 w-4" />
          <span>Terapkan Filter</span>
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-2.5 text-xs"
      aria-label="Filter global: properti, OTA, dan periode"
    >
      {/* Properti Filter */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-muted-foreground whitespace-nowrap hidden sm:inline">
          Properti:
        </span>
        <select
          id="global-property"
          name="propertyId"
          defaultValue={propertyId ?? ""}
          className="cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
        >
          <option value="">Semua Properti</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Saluran / OTA Filter */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
        <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-muted-foreground whitespace-nowrap hidden sm:inline">
          OTA:
        </span>
        <select
          id="global-channel"
          name="channel"
          defaultValue={channel ?? ""}
          className="cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
        >
          <option value="">Semua Saluran</option>
          {CHANNEL_PRESETS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Periode Filter */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
        <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-muted-foreground whitespace-nowrap hidden sm:inline">
          Periode:
        </span>
        <select
          id="global-period"
          name="period"
          defaultValue={period}
          className="cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
        >
          {PERIOD_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Date Range if selected */}
      {period === "custom" ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
          <input
            id="global-from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            aria-label="Tanggal mulai"
            className="bg-transparent text-xs font-medium text-foreground focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">s/d</span>
          <input
            id="global-to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            aria-label="Tanggal akhir"
            className="bg-transparent text-xs font-medium text-foreground focus:outline-none"
          />
        </div>
      ) : null}

      <Button type="submit" size="sm" variant="default" className="h-8 gap-1.5 px-3 shadow-xs">
        <Filter className="h-3.5 w-3.5" />
        <span>Terapkan</span>
      </Button>
    </form>
  );
}
