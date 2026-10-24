/**
 * Halaman "Perlu Perhatian" / Karantina (S9-03 / S2-03) - Server Component.
 *
 * Menampilkan item impor dari email atau CSV yang membutuhkan peninjauan,
 * pemetaan manual listing tak dikenal, atau tindakan koreksi.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAttentionItems } from "@/server/queries/attention";
import { getListingOptions } from "@/server/queries/listings";
import { AttentionView } from "./attention-view";

export const metadata = { title: "Perlu Perhatian - Hillside Eden" };

export const instant = false;

export default async function AttentionPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const [{ items, counts }, listingOptions] = await Promise.all([
    getAttentionItems(organizationId),
    getListingOptions(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Perlu Perhatian
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Pusat karantina untuk data reservasi yang membutuhkan konfirmasi pemetaan unit atau
            tindakan perbaikan.
          </p>
        </div>
      </header>

      <AttentionView initialItems={items} counts={counts} listingOptions={listingOptions} />
    </div>
  );
}
