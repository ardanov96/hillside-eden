import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/format-id";
import { ChannelChip } from "@/app/(app)/bookings/booking-chips";
import type { ChannelSharePoint } from "@/server/queries/dashboard";

export interface ChannelBreakdownProps {
  channels: ChannelSharePoint[];
}

export function ChannelBreakdownCard({ channels }: ChannelBreakdownProps) {
  return (
    <Card className="border-border/70 shadow-sm bg-card flex flex-col justify-between">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-foreground">
          Pangsa Pasar per Saluran (OTA)
        </CardTitle>
        <CardDescription className="text-xs">
          Distribusi nilai gross dan kontribusi pendapatan bersih per platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {channels.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Belum ada data reservasi untuk periode ini.
          </p>
        ) : (
          channels.slice(0, 6).map((item) => (
            <div key={item.channel} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ChannelChip channel={item.channel} />
                  <span className="text-muted-foreground text-[11px]">({item.count} pesanan)</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-foreground">{formatIDR(item.gross)}</span>
                  <span className="text-[11px] font-bold text-muted-foreground w-11 text-right">
                    {item.sharePct}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
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
      </CardContent>
    </Card>
  );
}
