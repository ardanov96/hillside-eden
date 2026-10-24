/**
 * Halaman "Impor File OTA" (S9-01) - Server Component.
 *
 * Mengizinkan pemilik untuk mengunggah berkas CSV reservasi atau payout
 * dari Airbnb, Tiket.com, dan Traveloka langsung dari browser web.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UploadCloud } from "lucide-react";

import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportForm } from "./import-form";

export const metadata = { title: "Impor File OTA - Hillside Eden" };

export const instant = false;

export default async function ImportBookingPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

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
              <UploadCloud className="h-3 w-3" />
              <span>Sinkronisasi Berkas OTA</span>
            </Badge>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
            Impor data reservasi & payout OTA
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground">
            Unggah file ekspor CSV dari extranet Airbnb, Tiket.com, atau Traveloka. Sistem akan
            memproses reservasi, pembatalan, modifikasi, dan payout secara deterministik dan
            idempoten.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
