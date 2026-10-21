/**
 * Halaman Ringkasan (S4-01).
 *
 * Shell (navbar, bilah filter global, header, footer, <main>) sudah
 * dimiliki oleh `src/app/(app)/layout.tsx`. Halaman ini hanya merender
 * konten ringkasan.
 *
 * Kartu KPI + grafik + tabel per OTA adalah lingkup S4-02
 * (docs/01-development-plan.md). Untuk S4-01 halaman ini menampilkan
 * placeholder yang jujur: tidak ada angka dummy yang menyesatkan.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const metadata = { title: "Ringkasan - Hillside Eden" };

// Halaman ini membaca cookie sesi (auth()), sehingga tidak bisa di-prerender.
export const instant = false;

export default async function HomePage() {
  const session = await auth();
  // Middleware sudah menahan, tapi lapisan ini menjaga route tetap aman
  // bila matcher middleware berubah (DoD: route tanpa login ditolak).
  if (!session?.user) {
    redirect("/login");
  }
  const user = session.user;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Ringkasan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Selamat datang, {user.name ?? user.email}
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Monitoring booking dan keuangan untuk satu pemilik, banyak properti. Fokus: Tiket.com,
          Traveloka, Airbnb.
        </p>
      </header>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Kartu ringkasan menyusul di S4-02
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Nilai booking (gross), Komisi OTA (estimasi), Pendapatan bersih (setelah komisi OTA),
          Pengeluaran, dan Hasil operasional akan tampil di sini, mengikuti bilah filter global di
          atas.
        </p>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          sementara itu,{" "}
          <Link
            href="/bookings"
            className="text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400"
          >
            daftar booking
          </Link>{" "}
          sudah berfungsi dan memakai filter global yang sama.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Akun
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.email}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-zinc-500">Peran</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.role ?? "OWNER"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
