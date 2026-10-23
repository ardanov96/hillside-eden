import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { ChannelChip } from "@/app/(app)/bookings/booking-chips";
import { formatIDR, formatDateShort } from "@/lib/format-id";
import type { RecentBookingItem } from "@/server/queries/dashboard";

export interface RecentBookingsCardProps {
  bookings: RecentBookingItem[];
}

export function RecentBookingsCard({ bookings }: RecentBookingsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 flex flex-col justify-between h-full">
      <div className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Aktivitas Reservasi Terbaru
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500">
              Daftar pesanan masuk paling mutakhir dari seluruh kanal penjualan
            </p>
          </div>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-zinc-300 transition-colors"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="space-y-2.5 pt-1">
        {bookings.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Belum ada aktivitas reservasi yang tercatat.
          </p>
        ) : (
          bookings.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-100/70 dark:border-zinc-800 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-mono text-xs font-bold text-white dark:bg-emerald-600">
                  {item.externalId.slice(-3).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {item.externalId}
                    </span>
                    <ChannelChip channel={item.channel} />
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
                    <span>{item.propertyName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateShort(item.checkIn)} - {formatDateShort(item.checkOut)} (
                      {item.nights} mlm)
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatIDR(item.netAmount)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
                  Gross: {formatIDR(item.grossAmount)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
