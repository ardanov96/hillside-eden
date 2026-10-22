import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/badges";
import { ChannelChip } from "@/app/(app)/bookings/booking-chips";
import { formatIDR, formatDateShort } from "@/lib/format-id";
import type { RecentBookingItem } from "@/server/queries/dashboard";

export interface RecentBookingsCardProps {
  bookings: RecentBookingItem[];
}

export function RecentBookingsCard({ bookings }: RecentBookingsCardProps) {
  return (
    <Card className="border-border/70 shadow-sm bg-card flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Aktivitas Reservasi Terbaru
            </CardTitle>
            <CardDescription className="text-xs">
              Daftar pesanan masuk paling mutakhir dari seluruh kanal penjualan
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild className="gap-1 text-xs text-primary">
            <Link href="/bookings">
              <span>Lihat Semua</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        {bookings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Belum ada aktivitas reservasi yang tercatat.
          </p>
        ) : (
          bookings.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                  {item.externalId.slice(-3).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {item.externalId}
                    </span>
                    <ChannelChip channel={item.channel} />
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatIDR(item.netAmount)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Gross: {formatIDR(item.grossAmount)}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
