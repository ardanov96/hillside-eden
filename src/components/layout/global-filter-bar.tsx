"use client";
/**
 * Bilah filter global (S4-01 + shadcn redesign) - Client Component.
 *
 * Mengontrol filter properti dan periode (bulan ini, bulan lalu, dll.)
 * yang berlaku melintasi seluruh halaman dashboard.
 */
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Filter } from "lucide-react";

import {
  PERIOD_LABEL,
  PERIOD_PRESETS,
  mergeKeepingNonGlobal,
  parseGlobalFilterSelection,
  serializeParams,
  type GlobalFilterKey,
  type PeriodPreset,
} from "@/lib/filters/global-filter";
import { Button } from "@/components/ui/button";

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
      className="flex flex-wrap items-center gap-2.5 text-xs"
      aria-label="Filter global: properti dan periode"
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
