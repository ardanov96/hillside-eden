/**
 * Kartu Pendapatan Kotor -> Komisi OTA -> Pendapatan Bersih Berdampingan (Sprint 7 / S7-05).
 *
 * Mengikuti konvensi label dan aturan bisnis:
 * - docs/07-ui-spec.md §3 (Kartu pendapatan berdampingan)
 * - ADR-004: Gross -> Komisi -> Net ditampilkan berdampingan dengan badge Estimasi/Aktual.
 * - docs/05 §5: Label "Pendapatan bersih (setelah komisi OTA)".
 */
import React from "react";
import type { CollectType, CommissionBasis } from "@prisma/client";
import { Decimal } from "@/lib/decimal";
import { formatCurrency, formatPercentId } from "@/lib/format-id";
import { DataStatusBadge } from "@/components/badges/data-status-badge";
import { CollectTypeBadge } from "@/components/badges/collect-type-badge";

export interface GrossCommissionNetCardProps {
  gross: Decimal | number | string;
  commission: Decimal | number | string;
  net?: Decimal | number | string;
  currency?: "IDR" | "USD";
  commissionRate?: Decimal | number | string | null;
  commissionBasis?: CommissionBasis | null;
  collectType?: CollectType | null;
  className?: string;
  title?: string;
  compact?: boolean;
}

export function GrossCommissionNetCard({
  gross,
  commission,
  net,
  currency = "IDR",
  commissionRate,
  commissionBasis = "ESTIMATED",
  collectType,
  className = "",
  title,
  compact = false,
}: GrossCommissionNetCardProps) {
  const grossDec = gross instanceof Decimal ? gross : new Decimal(gross);
  const commDec = commission instanceof Decimal ? commission : new Decimal(commission);
  const netDec =
    net !== undefined ? (net instanceof Decimal ? net : new Decimal(net)) : grossDec.minus(commDec);

  const rateDisplay =
    commissionRate !== undefined && commissionRate !== null
      ? formatPercentId(
          commissionRate instanceof Decimal ? commissionRate : new Decimal(commissionRate),
        )
      : grossDec.isZero()
        ? "0,0%"
        : formatPercentId(commDec.dividedBy(grossDec));

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 ${className}`}
      >
        <div>
          <span className="text-slate-500 font-medium">Kotor:</span>{" "}
          <span className="font-semibold text-slate-800">{formatCurrency(grossDec, currency)}</span>
        </div>
        <span className="text-slate-400">−</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 font-medium">Komisi:</span>{" "}
          <span className="font-semibold text-amber-700">{formatCurrency(commDec, currency)}</span>
          <DataStatusBadge
            commissionAmount={commDec}
            commissionBasis={commissionBasis}
            className="text-[10px] py-0"
          />
        </div>
        <span className="text-slate-400">=</span>
        <div>
          <span className="text-slate-500 font-medium">Bersih:</span>{" "}
          <span className="font-bold text-emerald-700">{formatCurrency(netDec, currency)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {collectType && <CollectTypeBadge collectType={collectType} className="text-xs" />}
        </div>
      )}

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* 1. Pendapatan Kotor */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-col justify-between h-full">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Pendapatan Kotor
            </span>
            <div className="mt-2">
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(grossDec, currency)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Nilai bruto sebelum potongan</span>
          </div>

          {/* 2. Komisi OTA */}
          <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100/70 flex flex-col justify-between h-full relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-900 uppercase tracking-wider">
                Komisi OTA
              </span>
              <DataStatusBadge commissionAmount={commDec} commissionBasis={commissionBasis} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-900 tracking-tight">
                {formatCurrency(commDec, currency)}
              </span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                {rateDisplay}
              </span>
            </div>
            <span className="text-[11px] text-amber-700/80 mt-1">Potongan perantara OTA</span>
          </div>

          {/* 3. Pendapatan Bersih (setelah komisi OTA) */}
          <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200/80 flex flex-col justify-between h-full shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Pendapatan Bersih
              </span>
              {collectType && !title && (
                <CollectTypeBadge collectType={collectType} className="text-[10px]" />
              )}
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-emerald-800 tracking-tight">
                {formatCurrency(netDec, currency)}
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700/90 mt-1">
              Pendapatan bersih (setelah komisi OTA)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
