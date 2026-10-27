"use client";
/**
 * Bilah filter global (S4-01 + shadcn redesign) - Client Component.
 *
 * Mengontrol filter properti, saluran OTA, dan periode (bulan ini, bulan lalu, dll.)
 * yang berlaku melintasi seluruh halaman dashboard.
 */
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, Filter, Globe, Loader2 } from "lucide-react";

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
  const [isPending, startTransition] = useTransition();

  const current = Object.fromEntries(searchParams.entries());
  const parsed = parseGlobalFilterSelection(current);

  const [customActive, setCustomActive] = useState(parsed.period === "custom");
  const [prevPeriod, setPrevPeriod] = useState(parsed.period);
  if (parsed.period !== prevPeriod) {
    setPrevPeriod(parsed.period);
    setCustomActive(parsed.period === "custom");
  }

  const isCustom = customActive || parsed.period === "custom";
  const selectedPeriod: PeriodPreset = isCustom ? "custom" : parsed.period;

  const [fromDate, setFromDate] = useState(parsed.from ?? "");
  const [toDate, setToDate] = useState(parsed.to ?? "");
  const [prevFrom, setPrevFrom] = useState(parsed.from ?? "");
  const [prevTo, setPrevTo] = useState(parsed.to ?? "");
  if ((parsed.from ?? "") !== prevFrom || (parsed.to ?? "") !== prevTo) {
    setPrevFrom(parsed.from ?? "");
    setPrevTo(parsed.to ?? "");
    setFromDate(parsed.from ?? "");
    setToDate(parsed.to ?? "");
  }

  const selectedProperty = parsed.propertyId ?? "";
  const selectedChannel = parsed.channel ?? "";

  function executeNavigation(updates: Partial<Record<GlobalFilterKey, string>>) {
    const merged = mergeKeepingNonGlobal(current, updates);
    startTransition(() => {
      router.push(`${pathname}${serializeParams(merged)}`);
      onApplied?.();
    });
  }

  function handlePropertyChange(newProp: string) {
    executeNavigation({
      propertyId: newProp,
      channel: selectedChannel,
      period: selectedPeriod,
      ...(selectedPeriod === "custom" ? { from: fromDate, to: toDate } : {}),
    });
  }

  function handleChannelChange(newChan: string) {
    executeNavigation({
      propertyId: selectedProperty,
      channel: newChan,
      period: selectedPeriod,
      ...(selectedPeriod === "custom" ? { from: fromDate, to: toDate } : {}),
    });
  }

  function handlePeriodChange(newPer: PeriodPreset) {
    if (newPer === "custom") {
      setCustomActive(true);
    } else {
      setCustomActive(false);
      executeNavigation({
        propertyId: selectedProperty,
        channel: selectedChannel,
        period: newPer,
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    executeNavigation({
      propertyId: selectedProperty,
      channel: selectedChannel,
      period: selectedPeriod,
      ...(selectedPeriod === "custom" ? { from: fromDate, to: toDate } : {}),
    });
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
              value={selectedProperty}
              onChange={(e) => handlePropertyChange(e.target.value)}
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
              value={selectedChannel}
              onChange={(e) => handleChannelChange(e.target.value)}
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
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodPreset)}
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

        {selectedPeriod === "custom" ? (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in-50 duration-150">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Mulai:</span>
              <input
                name="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-foreground dark:border-zinc-800 dark:bg-zinc-800"
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Sampai:</span>
              <input
                name="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-foreground dark:border-zinc-800 dark:bg-zinc-800"
              />
            </div>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-9 gap-1.5 font-semibold shadow-xs mt-1"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Filter className="h-4 w-4" />
          )}
          <span>{isPending ? "Menerapkan..." : "Terapkan Filter"}</span>
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
          value={selectedProperty}
          onChange={(e) => handlePropertyChange(e.target.value)}
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
          value={selectedChannel}
          onChange={(e) => handleChannelChange(e.target.value)}
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
          value={selectedPeriod}
          onChange={(e) => handlePeriodChange(e.target.value as PeriodPreset)}
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
      {selectedPeriod === "custom" ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs animate-in fade-in-50 duration-150">
          <input
            id="global-from"
            name="from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Tanggal mulai"
            className="bg-transparent text-xs font-medium text-foreground focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">s/d</span>
          <input
            id="global-to"
            name="to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Tanggal akhir"
            className="bg-transparent text-xs font-medium text-foreground focus:outline-none"
          />
        </div>
      ) : null}

      <Button
        type="submit"
        size="sm"
        variant="default"
        disabled={isPending}
        className="h-8 gap-1.5 px-3 shadow-xs"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Filter className="h-3.5 w-3.5" />
        )}
        <span>{isPending ? "Menerapkan..." : "Terapkan"}</span>
      </Button>
    </form>
  );
}
