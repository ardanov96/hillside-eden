/**
 * Halaman "Tambah Booking" manual (S2-04.3 + shadcn redesign) - Server Component.
 *
 * - Memastikan user sudah login (memuat organizationId).
 * - Mengambil daftar Listing untuk dropdown form.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";

import { auth } from "@/auth";
import { getListingOptions } from "@/server/queries/listings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingForm } from "./booking-form";

export const metadata = { title: "Tambah Booking - Hillside Eden" };

export const instant = false;

export default async function NewBookingPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const listings = await getListingOptions(organizationId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Daftar Booking</span>
        </Link>
      </div>

      <Card className="shadow-xs">
        <CardHeader className="pb-6 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 text-primary bg-primary/5 text-[11px]"
            >
              <PlusCircle className="h-3 w-3" />
              <span>Input Manual</span>
            </Badge>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
            Tambah booking manual
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground">
            Catat booking yang diterima langsung (telepon, walk-in, atau transfer bank) tanpa OTA.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <BookingForm listings={listings} />
        </CardContent>
      </Card>
    </div>
  );
}
