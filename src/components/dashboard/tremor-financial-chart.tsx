"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatIDR } from "@/lib/format-id";
import type { MonthlyChartPoint } from "@/server/queries/dashboard";

export interface FinancialChartProps {
  data: MonthlyChartPoint[];
}

function formatJuta(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `${Math.round(val / 1_000_000)}jt`;
  return `${val}`;
}

export function TremorFinancialChart({ data }: FinancialChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 h-full flex flex-col justify-between">
      <div className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Tren Transaksi &amp; Pendapatan Bulanan
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Perbandingan Gross, Pendapatan Bersih, Komisi OTA, dan Beban
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
              Mata Uang: IDR (Rp)
            </span>
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatJuta}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg text-xs space-y-1.5">
                      <p className="font-bold text-foreground border-b border-border pb-1">
                        Bulan: {label}
                      </p>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}:
                          </span>
                          <span className="font-bold text-foreground font-mono">
                            {formatIDR(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 15, fontSize: "11px" }}
              />
              <Bar
                name="Nilai booking (gross)"
                dataKey="gross"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                name="Pendapatan bersih"
                dataKey="net"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                name="Komisi OTA"
                dataKey="commission"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                name="Pengeluaran"
                dataKey="expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
