/**
 * Halaman "booking tidak ditemukan" untuk route `/bookings/[id]`.
 *
 * Dipanggil oleh `notFound()` ketika id tidak ada (atau bukan milik
 * organisasi yang sedang login).
 */
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function BookingNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-border/80 bg-card px-6 py-14 text-center shadow-xs">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          Booking tidak ditemukan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Booking dengan id tersebut tidak ada, atau bukan milik organisasi yang sedang login.
        </p>
      </div>
      <Link
        href="/bookings"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Kembali ke Daftar Booking</span>
      </Link>
    </div>
  );
}
