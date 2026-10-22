import { formatIDR } from "@/lib/format-id";
import { ChannelChip } from "@/app/(app)/bookings/booking-chips";
import type { ChannelSharePoint } from "@/server/queries/dashboard";

export interface ChannelBreakdownProps {
  channels: ChannelSharePoint[];
}

export function ChannelBreakdownCard({ channels }: ChannelBreakdownProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90 flex flex-col justify-between h-full">
      <div className="pb-3">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Rincian Saluran Penjualan
        </h3>
        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
          Distribusi nilai gross dan kontribusi pendapatan bersih per platform
        </p>
      </div>
      <div className="space-y-4 pt-1">
        {channels.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Belum ada data reservasi untuk periode ini.
          </p>
        ) : (
          channels.slice(0, 6).map((item) => (
            <div key={item.channel} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ChannelChip channel={item.channel} />
                  <span className="text-slate-400 text-[11px]">({item.count} pesanan)</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatIDR(item.gross)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 w-11 text-right">
                    {item.sharePct}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(2, item.sharePct))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
