/**
 * Halaman utama Bookings (S2-07.2) - Server Component.
 *
 * Middleware sudah seharusnya menahan akses tanpa sesi, tapi lapisan ini
 * memaksa login + memuat organizationId dari JWT (lihat ADR-002).
 */
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BookingList } from "./booking-list";

export const metadata = { title: "Daftar Booking - Hillside Eden" };
// Halaman ini membaca cookie sesi (auth()) dan searchParams, sehingga tidak
// bisa di-prerender saat build. `instant = false` memberi izin route dinamis.
export const instant = false;

export default async function BookingsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const sp = await props.searchParams;

  // `<main>` dan pembungkus max-width sekarang milik shell
  // `(app)/layout.tsx` (S4-01).
  return <BookingList organizationId={organizationId} searchParams={sp} />;
}
