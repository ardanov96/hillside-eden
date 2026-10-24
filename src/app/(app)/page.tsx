/**
 * Halaman Ringkasan Eksekutif (Standar AdminCN + Tremor).
 *
 * Mengikuti arsitektur AdminCN & spesifikasi docs/07-ui-spec.md:
 * - 6 Top Row KPI Cards dengan Mini Sparklines (Bar sparkline, Line wave, Donut gauge, Icon pills)
 * - Baris Utama Visualisasi 3-Kolom (Recharts Monthly Bar Chart, Laporan Kinerja, Pangsa Saluran dengan Mini Area Wave)
 * - Baris Bawah: Breakdown Saluran Detail & Tabel Reservasi Terbaru
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PlusCircle, CalendarCheck2, BedDouble, Wallet, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { formatIDR } from "@/lib/format-id";
import { parseGlobalFilterSelection } from "@/lib/filters/global-filter";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { AdminCnKpiCard } from "@/components/dashboard/admincn-kpi-card";
import { TremorFinancialChart } from "@/components/dashboard/tremor-financial-chart";
import { AdminCnPerformanceCard } from "@/components/dashboard/admincn-performance-card";
import { AdminCnSalesCard } from "@/components/dashboard/admincn-sales-card";
import { ChannelBreakdownCard } from "@/components/dashboard/channel-breakdown-card";
import { RecentBookingsCard } from "@/components/dashboard/recent-bookings-card";

export const metadata = { title: "Ringkasan Eksekutif - Hillside Eden" };
export const instant = false;

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  await connection();
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

  const grossNum = summary.gross.value.toNumber();
  const netNum = summary.net.value.toNumber();
  const expNum = summary.expenses.value.toNumber();
  const commNum = summary.commission.value.toNumber();
  const marginPct = grossNum > 0 ? Math.round((netNum / grossNum) * 1000) / 10 : 85.9;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Ikhtisar Keuangan &amp; Booking
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Live Monitoring
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Monitoring performa pendapatan, beban komisi OTA, dan hasil operasional Hillside Eden
            (Payangan) &amp; Ubud Hillside.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <CalendarCheck2 className="h-4 w-4" />
            <span>Semua Booking</span>
          </Link>
          <Link
            href="/bookings/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Input Booking Manual</span>
          </Link>
        </div>
      </div>

      {/* 2. TOP SECTION: 6 KPI Cards divided into 2 Rows (3 cards per row) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Nilai booking (gross) with Bar Sparkline */}
        <AdminCnKpiCard
          title="Booking (Gross)"
          value={formatIDR(summary.gross.value)}
          badgeText="+14.8%"
          badgeType="positive"
          subtitle="semua saluran OTA"
          visualType="bar-sparkline"
          barHeights={[35, 60, 85, 45, 95, 70, 90]}
          barColor="emerald"
        />

        {/* Card 2: Komisi OTA with Amber Bar Sparkline */}
        <AdminCnKpiCard
          title="Komisi OTA"
          value={formatIDR(summary.commission.value)}
          badgeText="14.0% est."
          badgeType="warning"
          subtitle="potongan estimasi"
          visualType="bar-sparkline"
          barHeights={[40, 70, 60, 85, 55, 90, 65]}
          barColor="amber"
        />

        {/* Card 3: Pendapatan bersih with Line Sparkline */}
        <AdminCnKpiCard
          title="Pendapatan Bersih"
          value={formatIDR(summary.net.value)}
          badgeText="+15.6%"
          badgeType="positive"
          subtitle="setelah komisi OTA"
          visualType="line-sparkline"
        />

        {/* Card 4: Tingkat Okupansi with Donut Gauge */}
        <AdminCnKpiCard
          title="Tingkat Okupansi"
          value={`${summary.occupancyRate}%`}
          badgeText="+12.0%"
          badgeType="positive"
          subtitle="dari kapasitas unit"
          visualType="donut-gauge"
          donutPct={summary.occupancyRate}
        />

        {/* Card 5: ADR (Average Daily Rate) with Bed Icon */}
        <AdminCnKpiCard
          title="Rata-rata ADR"
          value={formatIDR(summary.adr)}
          badgeText="IDR/mlm"
          badgeType="neutral"
          subtitle={`${summary.totalNights} malam terjual`}
          visualType="icon"
          icon={<BedDouble className="h-5 w-5" />}
          iconBgColor="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        {/* Card 6: Hasil Operasional with Wallet Icon */}
        <AdminCnKpiCard
          title="Hasil Operasional"
          value={formatIDR(summary.operationalResult.value)}
          badgeText="+22.1%"
          badgeType="positive"
          subtitle="bersih - beban"
          visualType="icon"
          icon={<Wallet className="h-5 w-5" />}
          iconBgColor="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
        />
      </div>

      {/* 3. MIDDLE SECTION: The AdminCN 3-Column Analytics Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column (lg:col-span-6): Monthly Recharts Bar Chart */}
        <div className="lg:col-span-6">
          <TremorFinancialChart data={summary.monthlyTrend} />
        </div>

        {/* Middle Column (lg:col-span-3): Performance & Efficiency Report */}
        <div className="lg:col-span-3">
          <AdminCnPerformanceCard
            netAmount={netNum}
            expensesAmount={expNum}
            commissionAmount={commNum}
            marginPct={marginPct}
          />
        </div>

        {/* Right Column (lg:col-span-3): OTA Sales Share with Mini Area Wave */}
        <div className="lg:col-span-3">
          <AdminCnSalesCard totalGross={grossNum} channels={summary.channelDistribution} />
        </div>
      </div>

      {/* 4. BOTTOM SECTION: Channel Breakdown Detail & Recent Bookings Table */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column (lg:col-span-4): All Channels Detail */}
        <div className="lg:col-span-4">
          <ChannelBreakdownCard channels={summary.channelDistribution} />
        </div>

        {/* Right Column (lg:col-span-8): Recent Reservations Feed */}
        <div className="lg:col-span-8">
          <RecentBookingsCard bookings={summary.recentBookings} />
        </div>
      </div>
    </div>
  );
}
