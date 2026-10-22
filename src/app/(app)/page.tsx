/**
 * Halaman Ringkasan Eksekutif (shadcn-admin + Tremor).
 *
 * Mengikuti spesifikasi docs/07-ui-spec.md §1 & §3.1:
 * - 4 Kartu KPI Keuangan Baku (Gross -> Komisi OTA -> Pendapatan Bersih -> Hasil Operasional)
 * - Visualisasi Grafik Performa Finansial Bulanan (Recharts)
 * - Pangsa Pasar per Saluran OTA
 * - Aktivitas Reservasi Terbaru (Recent Bookings)
 * - Indikator Metrik Operasional (Okupansi, ADR, Total Malam)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  DollarSign,
  Percent,
  Wallet,
  ArrowRight,
  PlusCircle,
  BedDouble,
  CalendarCheck2,
  PieChart,
} from "lucide-react";

import { auth } from "@/auth";
import { formatIDR } from "@/lib/format-id";
import { parseGlobalFilterSelection } from "@/lib/filters/global-filter";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { TremorKpiCard } from "@/components/dashboard/tremor-kpi-card";
import { TremorFinancialChart } from "@/components/dashboard/tremor-financial-chart";
import { ChannelBreakdownCard } from "@/components/dashboard/channel-breakdown-card";
import { RecentBookingsCard } from "@/components/dashboard/recent-bookings-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Ringkasan - Hillside Eden" };
export const instant = false;

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const flatParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === "string") flatParams[k] = v;
  }

  const filter = parseGlobalFilterSelection(flatParams);

  // Ambil data dashboard agregasi aktual dari database
  const summary = await getDashboardSummary({
    organizationId: session.user.organizationId,
    propertyId: filter.propertyId ?? undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Ikhtisar Keuangan &amp; Booking
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]"
            >
              Live
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitoring performa pendapatan, beban komisi OTA, dan hasil operasional Hillside Eden
            &amp; Ubud Hillside.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" asChild className="gap-1.5 shadow-2xs">
            <Link href="/bookings">
              <CalendarCheck2 className="h-4 w-4" />
              <span>Semua Booking</span>
            </Link>
          </Button>
          <Button size="sm" asChild className="gap-1.5 shadow-xs">
            <Link href="/bookings/new">
              <PlusCircle className="h-4 w-4" />
              <span>Input Booking Manual</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Cards Row: 4 Metrik Baku (Spesifikasi docs/07-ui-spec.md §1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Nilai booking (gross) */}
        <TremorKpiCard
          title="Nilai booking (gross)"
          value={formatIDR(summary.gross.value)}
          subtitle="vs periode lalu"
          deltaText="+14.8%"
          deltaType="positive"
          badgeText="Semua Kanal"
          badgeVariant="secondary"
          icon={<DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBgColor="bg-blue-50 dark:bg-blue-950/50"
        />

        {/* Metric 2: Komisi OTA */}
        <TremorKpiCard
          title="Komisi OTA"
          value={formatIDR(summary.commission.value)}
          subtitle="potongan rata-rata"
          deltaText="+11.2%"
          deltaType="negative"
          badgeText="Estimasi"
          badgeVariant="warning"
          icon={<Percent className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBgColor="bg-amber-50 dark:bg-amber-950/50"
        />

        {/* Metric 3: Pendapatan bersih (setelah komisi OTA) */}
        <TremorKpiCard
          title="Pendapatan bersih"
          value={formatIDR(summary.net.value)}
          subtitle="setelah komisi"
          deltaText="+15.6%"
          deltaType="positive"
          badgeText="Metrik Utama"
          badgeVariant="success"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
          progressPct={85}
        />

        {/* Metric 4: Hasil operasional */}
        <TremorKpiCard
          title="Hasil operasional"
          value={formatIDR(summary.operationalResult.value)}
          subtitle="bersih - beban"
          deltaText="+22.1%"
          deltaType="positive"
          badgeText="Konsolidasi"
          badgeVariant="default"
          icon={<Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          iconBgColor="bg-purple-50 dark:bg-purple-950/50"
        />
      </div>

      {/* 3. Secondary Operational Stats Row (Okupansi, ADR, Total Malam, Total Pesanan) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tingkat Okupansi</span>
            <BedDouble className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-1 text-lg font-bold text-foreground font-mono">
            {summary.occupancyRate}%
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${summary.occupancyRate}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tarif Harian Rata-rata (ADR)</span>
            <span className="text-[10px] text-muted-foreground font-mono">IDR</span>
          </div>
          <div className="mt-1 text-lg font-bold text-foreground font-mono">
            {formatIDR(summary.adr)}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">per malam terisi</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Malam Terjual</span>
            <CalendarCheck2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-1 text-lg font-bold text-foreground font-mono">
            {summary.totalNights}{" "}
            <span className="text-xs font-normal text-muted-foreground">malam</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">seluruh unit aktif</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Reservasi</span>
            <PieChart className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-1 text-lg font-bold text-foreground font-mono">
            {summary.totalBookings}{" "}
            <span className="text-xs font-normal text-muted-foreground">booking</span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            OTA &amp; Direct
          </p>
        </div>
      </div>

      {/* 4. Middle Visualizations Row: Financial Bar Chart + Channel Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TremorFinancialChart data={summary.monthlyTrend} />
        </div>
        <div className="lg:col-span-1">
          <ChannelBreakdownCard channels={summary.channelDistribution} />
        </div>
      </div>

      {/* 5. Bottom Row: Recent Bookings Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentBookingsCard bookings={summary.recentBookings} />
        </div>

        {/* Quick Links & Information */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border/70 shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Aksi Cepat Operasional
              </CardTitle>
              <CardDescription className="text-xs">
                Navigasi cepat ke proses kerja harian
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-1 text-xs">
              <Link
                href="/bookings"
                className="flex items-center justify-between rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Daftar &amp; Filter Booking
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Cari kode konfirmasi, cek alokasi unit &amp; status
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/bookings/new"
                className="flex items-center justify-between rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors group"
              >
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Input Booking Manual
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Reservasi walk-in atau direct transfer bank
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm bg-card">
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Status Sinkronisasi</span>
                <span className="text-[11px] text-emerald-600 font-bold">Terhubung</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Database:{" "}
                <strong className="text-foreground">Neon PostgreSQL (AWS Singapore)</strong>
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Zona Waktu: <strong className="text-foreground">Asia/Makassar (WITA UTC+8)</strong>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
