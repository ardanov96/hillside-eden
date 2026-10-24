/**
 * Halaman Pengaturan Listing & Integrasi OTA (S9-02) - Server Component.
 *
 * Mengelola daftar listing OTA, pemetaan unit fisik villa, dan sinkronisasi feed iCal.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getListingsWithDetails } from "@/server/queries/listings";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Pengaturan Listing - Hillside Eden" };

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const listings = await getListingsWithDetails(organizationId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pengaturan
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Kelola listing OTA, integrasi sinkronisasi kalender iCal, dan relasi unit villa.
          </p>
        </div>
      </header>

      <SettingsView listings={listings} />
    </div>
  );
}
