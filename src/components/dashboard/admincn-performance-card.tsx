"use client";

import Link from "next/link";
import { TrendingUp, Receipt, ArrowRight, ShieldCheck } from "lucide-react";
import { formatIDR } from "@/lib/format-id";

export interface AdminCnPerformanceCardProps {
  netAmount: number;
  expensesAmount: number;
  commissionAmount: number;
  marginPct: number;
}

export function AdminCnPerformanceCard({
  netAmount,
  expensesAmount,
  commissionAmount,
  marginPct,
}: AdminCnPerformanceCardProps) {
  const totalDeductions = expensesAmount + commissionAmount;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Laporan Kinerja
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Performa margin &amp; beban operasional
            </p>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </span>
        </div>

        {/* 2 Stacked Stat Cards with full horizontal width for nominals */}
        <div className="mt-3.5 space-y-2.5">
          {/* Box 1: Pendapatan Bersih */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight dark:text-zinc-400 truncate">
                  Pendapatan Bersih
                </span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                +15.6% vs target
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 text-slate-900 dark:text-white min-w-0">
              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 select-none shrink-0">
                Rp
              </span>
              <span className="text-base font-bold tabular-nums tracking-tight truncate">
                {formatIDR(netAmount).slice(3)}
              </span>
            </div>
          </div>

          {/* Box 2: Total Beban Operasional & Komisi */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight dark:text-zinc-400 truncate">
                  Total Beban
                </span>
              </div>
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full dark:bg-amber-950/60 dark:text-amber-400 shrink-0">
                -8.2% efisiensi
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1 text-slate-900 dark:text-white min-w-0">
              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 select-none shrink-0">
                Rp
              </span>
              <span className="text-base font-bold tabular-nums tracking-tight truncate">
                {formatIDR(totalDeductions).slice(3)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Performance Pill & Action Button */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Efisiensi Margin
            </span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{marginPct}%
            </span>
          </div>

          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <span>Lihat Laporan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
