/**
 * Halaman detail booking (S2-07.3) - Server Component.
 *
 * Route: `/bookings/[id]`. Tautan dari tabel booking mengarah ke sini, jadi
 * halaman ini harus selalu tersedia (sebelumnya link-nya 404).
 *
 * Membaca cookie sesi (auth()) dan params dinamis, sehingga tidak bisa
 * di-prerender saat build. `instant = false` memberi izin route dinamis
 * (OD-20).
 */
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getBookingDetail } from "@/server/queries/bookings";
import { BookingDetailView } from "./booking-detail-view";

export const metadata = { title: "Detail Booking - Hillside Eden" };

export const instant = false;

export default async function BookingDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const { id } = await props.params;
  const detail = await getBookingDetail(organizationId, id);
  if (!detail) {
    notFound();
  }

  return <BookingDetailView detail={detail} />;
}
