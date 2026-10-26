"use client";

/**
 * Lencana Kesegaran Data per Sumber (Data Freshness Badges).
 *
 * Mengikuti spesifikasi docs/07-ui-spec.md §3.1:
 * "Lencana kesegaran data per sumber: nama sumber, waktu sinkron terakhir, jumlah item 'perlu perhatian'."
 */
import * as React from "react";
import Link from "next/link";
import { Activity, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

import type { DashboardFreshnessResult } from "@/server/queries/dashboard";

interface DataFreshnessBadgesProps {
  freshnessData: DashboardFreshnessResult;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Belum sinkron";

  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return "Kemarin";
  return `${diffDays} hari lalu`;
}

export function DataFreshnessBadges({ freshnessData }: DataFreshnessBadgesProps) {
  const { sources, needsReviewCount } = freshnessData;

  // Saring channel yang memiliki data atau channel utama OTA
  const activeSources = sources.filter(
    (s) =>
      s.channel === "AIRBNB" ||
      s.channel === "TIKET_COM" ||
      s.channel === "TRAVELOKA" ||
      s.lastSyncAt !== null,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60 shadow-2xs">
      {/* Label & Status Pill Kanal */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-300">
          <Activity className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
          <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Kesegaran Sumber:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeSources.map((s) => {
            const isFresh = s.status === "fresh";
            const isStale = s.status === "stale";

            return (
              <div
                key={s.channel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title={`Sumber: ${s.label} (${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("id-ID") : "Belum ada batch"})`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isFresh
                      ? "bg-emerald-500 ring-2 ring-emerald-400/20"
                      : isStale
                        ? "bg-amber-500 ring-2 ring-amber-400/20"
                        : "bg-slate-300 dark:bg-zinc-600"
                  }`}
                />
                <span className="font-semibold text-slate-900 dark:text-white">{s.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {formatRelativeTime(s.lastSyncAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lencana Karantina / Perlu Perhatian */}
      <div className="flex items-center gap-2">
        {needsReviewCount > 0 ? (
          <Link
            href="/attention"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70 transition-colors"
          >
            <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>{needsReviewCount} Perlu Perhatian</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Karantina bersih (0)</span>
          </span>
        )}
      </div>
    </div>
  );
}
