"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminCnKpiCardProps {
  title: string;
  value: string;
  badgeText?: string;
  badgeType?: "positive" | "negative" | "warning" | "neutral";
  subtitle?: string;
  visualType?: "bar-sparkline" | "line-sparkline" | "donut-gauge" | "icon";
  barHeights?: number[]; // Heights in percentage (e.g. [30, 50, 75, 40, 90, 60, 85])
  barColor?: "emerald" | "amber" | "blue" | "purple";
  donutPct?: number; // 0 to 100
  donutLabel?: string;
  icon?: ReactNode;
  iconBgColor?: string;
  className?: string;
}

export function AdminCnKpiCard({
  title,
  value,
  badgeText,
  badgeType = "positive",
  subtitle,
  visualType = "icon",
  barHeights = [35, 55, 80, 45, 95, 65, 85],
  barColor = "emerald",
  donutPct = 78,
  donutLabel,
  icon,
  iconBgColor = "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  className,
}: AdminCnKpiCardProps) {
  const isPositive = badgeType === "positive";
  const isNegative = badgeType === "negative";
  const isWarning = badgeType === "warning";

  const isRupiah = value.startsWith("Rp ");

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/90",
        className,
      )}
    >
      {/* 1. Header: Title on Left, Sparkline / Visual on Right */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold tracking-tight text-slate-500 uppercase dark:text-zinc-400">
          {title}
        </span>

        {/* Visual Sparkline / Gauge / Icon */}
        <div className="shrink-0">
          {visualType === "bar-sparkline" && (
            <div className="flex items-end gap-1 h-7 w-16 justify-end">
              {barHeights.map((h, i) => {
                const isTall = i === barHeights.length - 2 || i === barHeights.length - 1;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 rounded-full transition-all duration-300",
                      barColor === "emerald" &&
                        (isTall ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-900/60"),
                      barColor === "amber" &&
                        (isTall ? "bg-amber-500" : "bg-amber-200 dark:bg-amber-900/60"),
                      barColor === "blue" &&
                        (isTall ? "bg-blue-500" : "bg-blue-200 dark:bg-blue-900/60"),
                      barColor === "purple" &&
                        (isTall ? "bg-purple-500" : "bg-purple-200 dark:bg-purple-900/60"),
                    )}
                    style={{ height: `${Math.max(20, Math.min(100, h))}%` }}
                  />
                );
              })}
            </div>
          )}

          {visualType === "line-sparkline" && (
            <div className="h-7 w-16 flex items-center justify-end">
              <svg className="w-16 h-7 overflow-visible" viewBox="0 0 56 24" fill="none">
                <path
                  d="M2 20 C 10 18, 16 6, 26 12 C 36 18, 44 4, 54 2"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="54" cy="2" r="2.5" fill="#10b981" />
              </svg>
            </div>
          )}

          {visualType === "donut-gauge" && (
            <div className="relative h-9 w-9 flex items-center justify-center">
              <svg className="h-9 w-9 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-zinc-800"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-500"
                  strokeDasharray={`${donutPct}, 100`}
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-slate-700 tabular-nums dark:text-zinc-300">
                {donutLabel ?? `${donutPct}%`}
              </span>
            </div>
          )}

          {visualType === "icon" && icon && (
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl shadow-2xs",
                iconBgColor,
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </div>

      {/* 2. Value: Generous & Legible */}
      <div className="mt-3.5">
        {isRupiah ? (
          <div className="flex items-baseline gap-1" title={value}>
            <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500 select-none">
              Rp
            </span>
            <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-white leading-none">
              {value.slice(3)}
            </span>
          </div>
        ) : (
          <div
            className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-white leading-none"
            title={value}
          >
            {value}
          </div>
        )}
      </div>

      {/* 3. Footer: Trend Badge & Context Subtitle */}
      <div className="mt-4 flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
        {badgeText ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shrink-0",
              isPositive &&
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
              isNegative && "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
              isWarning && "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
              badgeType === "neutral" &&
                "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
            )}
          >
            {isPositive && <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />}
            {isNegative && <ArrowDownRight className="h-3.5 w-3.5 stroke-[2.5]" />}
            <span>{badgeText}</span>
          </span>
        ) : null}
        {subtitle ? (
          <span className="text-xs text-slate-500 dark:text-zinc-400" title={subtitle}>
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}
