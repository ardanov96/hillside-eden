"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { formatIDR } from "@/lib/format-id";
import type { ChannelSharePoint } from "@/server/queries/dashboard";

export interface AdminCnSalesCardProps {
  totalGross: number;
  channels: ChannelSharePoint[];
}

const miniWaveData = [
  { time: "08:00", value: 12 },
  { time: "10:00", value: 18 },
  { time: "12:00", value: 15 },
  { time: "14:00", value: 26 },
  { time: "16:00", value: 22 },
  { time: "18:00", value: 34 },
  { time: "20:00", value: 30 },
  { time: "22:00", value: 42 },
];

export function AdminCnSalesCard({ totalGross, channels }: AdminCnSalesCardProps) {
  const topChannels = channels.slice(0, 3);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Pangsa Penjualan
          </h3>
          <Link
            href="/bookings"
            className="text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Detail
          </Link>
        </div>

        {/* Big Value */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 select-none">
            Rp
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl dark:text-white">
            {formatIDR(totalGross).slice(3)}
          </span>
          <span className="ml-1.5 inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
            +14.8%
          </span>
        </div>

        {/* Breakdown Channel Rows matching AdminCN */}
        <div className="mt-4 space-y-2.5">
          {topChannels.map((c) => (
            <div key={c.channel} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-medium text-slate-600 dark:text-zinc-300">{c.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatIDR(c.gross)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {c.sharePct}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${c.sharePct}%`, backgroundColor: c.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini Area Chart Curve (matching AdminCN mini area wave) */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={miniWaveData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-sm font-mono dark:border-zinc-800 dark:bg-zinc-900">
                        {payload[0]?.value} pesanan
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#salesWaveGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
