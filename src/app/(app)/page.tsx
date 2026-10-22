/**
 * Halaman Ringkasan (S4-01 + shadcn redesign).
 *
 * Menampilkan ringkasan eksekutif dan KPI utama manajemen properti
 * Hillside Eden & Ubud Hillside.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, DollarSign, Percent, Wallet, ArrowRight, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ringkasan - Hillside Eden" };

export const instant = false;

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const user = session.user;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5">
              <Sparkles className="h-3 w-3" />
              <span>Monitoring Realtime</span>
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Selamat datang, {user.name ?? "Pemilik"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dashboard terpadu booking dan keuangan properti Hillside Eden (Payangan) & Ubud
            Hillside.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="default" className="gap-2 shadow-xs">
            <Link href="/bookings/new">
              <span>Tambah Booking Manual</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row (Spesifikasi 07-ui-spec §3.1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Nilai Booking Gross */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nilai booking (gross)
            </CardTitle>
            <div className="rounded-md bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">Rp --</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total bruto seluruh pesanan OTA & Direct
            </p>
            <div className="mt-3">
              <Badge variant="secondary" className="text-[10px]">
                Di-refresh via filter
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Komisi OTA */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Komisi OTA
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">Rp --</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimasi potongan komisi saluran (OTA)
            </p>
            <div className="mt-3">
              <Badge variant="warning" className="text-[10px]">
                Estimasi
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pendapatan Bersih */}
        <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wider">
              Pendapatan bersih
            </CardTitle>
            <div className="rounded-md bg-primary p-2 text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-primary">Rp --</div>
            <p className="mt-1 text-xs text-muted-foreground">Setelah dikurangi komisi OTA</p>
            <div className="mt-3">
              <Badge variant="success" className="text-[10px]">
                Metrik Utama
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Hasil Operasional */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Hasil operasional
            </CardTitle>
            <div className="rounded-md bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">Rp --</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pendapatan bersih - pengeluaran operasional
            </p>
            <div className="mt-3">
              <Badge variant="secondary" className="text-[10px]">
                Konsolidasi
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Modul Operasional Aktif</CardTitle>
          <CardDescription>
            Akses langsung ke manajemen pesanan dan alur kerja harian.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/bookings"
              className="group flex flex-col justify-between rounded-xl border border-border p-4 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Daftar Booking
                  </h3>
                  <Badge variant="success" className="text-[10px]">
                    Live
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Kelola dan filter data reservasi dari Tiket.com, Traveloka, Airbnb, serta booking
                  langsung.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                <span>Buka daftar booking</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/bookings/new"
              className="group flex flex-col justify-between rounded-xl border border-border p-4 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Input Booking Manual
                  </h3>
                  <Badge variant="success" className="text-[10px]">
                    Live
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Input pesanan walk-in, reservasi telepon, atau direct transfer bank dengan
                  validasi jadwal otomatis.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
                <span>Buat booking baru</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Status Akun & Konfigurasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div>
              <span className="text-muted-foreground">Email Terdaftar:</span>
              <p className="mt-0.5 font-medium text-foreground">{user.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Hak Akses:</span>
              <p className="mt-0.5 font-medium text-foreground">{user.role ?? "OWNER"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Basis Data:</span>
              <p className="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                Neon Cloud PostgreSQL (Aktif)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
