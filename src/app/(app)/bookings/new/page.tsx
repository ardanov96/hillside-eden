/**
 * Halaman "Tambah Booking" manual (S2-04.3) - Server Component.
 *
 * - Memastikan user sudah login (middleware sudah, tapi butuh organizationId).
 * - Mengambil daftar Listing untuk dropdown form.
 */
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { getListingOptions } from "@/server/queries/listings";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Tambah Booking - Hillside Eden" };

// Halaman ini membaca cookie sesi (auth()) dan query DB, sehingga tidak bisa
// di-prerender saat build. `instant = false` memberi izin route dinamis.
export const instant = false;

export default async function NewBookingPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const listings = await getListingOptions(organizationId);

  // Shell `(app)/layout.tsx` sudah menyediakan <main>; halaman ini hanya
  // merender konten (S4-01).
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8 space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Hillside Eden
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tambah booking manual
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Catat booking yang diterima langsung (telepon, walk-in, atau transfer bank) tanpa OTA.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <BookingForm listings={listings} />
      </section>

      <footer className="mt-6 flex items-center justify-between text-xs text-zinc-500">
        <span>Zona waktu: Asia/Makassar (WITA)</span>
        <Link href="/bookings" className="text-emerald-600 hover:underline dark:text-emerald-400">
          Kembali ke daftar booking
        </Link>
      </footer>
    </div>
  );
}
