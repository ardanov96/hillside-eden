/**
 * Layout route group `(app)` - shell dashboard (S4-01).
 *
 * Route group tidak menambah segmen URL, jadi `/` dan `/bookings` tetap
 * sama seperti sebelumnya tetapi sekarang mewarisi shell (navbar + bilah
 * filter global).
 *
 * Catatan Next.js 15: layout TIDAK menerima `searchParams`. Karena itu
 * komponen yang butuh query string (bilah filter, navbar) membacanya
 * sendiri lewat `useSearchParams()`, sedangkan halaman yang butuh rentang
 * tanggal untuk query database memanggil `parseGlobalFilter` sendiri
 * dengan `todayInWITA()` disuntik. Modulnya murni, jadi tidak ada sumber
 * kebenaran ganda.
 */
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getPropertyOptions } from "@/server/queries/listings";

// Membaca cookie sesi lewat auth(): tidak bisa di-prerender saat build.
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const properties = await getPropertyOptions(organizationId);

  return (
    <AppShell userEmail={session.user.email ?? undefined} properties={properties}>
      {children}
    </AppShell>
  );
}
