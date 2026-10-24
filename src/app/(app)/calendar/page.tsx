/**
 * Halaman Kalender Okupansi & Deteksi Bentrok (S10-01 / S4-05) - Server Component.
 *
 * Menampilkan ketersediaan kamar harian, booking lintas saluran OTA,
 * blok iCal eksternal, serta deteksi bentrok (double-booking).
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toStayDate } from "@/lib/dates";
import { getCalendarData } from "@/server/queries/calendar";
import { getPropertyOptions } from "@/server/queries/listings";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Kalender Okupansi - Hillside Eden" };

export const instant = false;

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CalendarPage(props: CalendarPageProps) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const sp = await props.searchParams;

  // Tentukan default tanggal saat ini dalam WITA
  const todayWita = toStayDate(new Date());
  const [currentYearStr, currentMonthStr] = todayWita.split("-");
  const defaultYear = Number.parseInt(currentYearStr ?? "2026", 10);
  const defaultMonth = Number.parseInt(currentMonthStr ?? "1", 10);

  const yearParam = typeof sp.year === "string" ? Number.parseInt(sp.year, 10) : defaultYear;
  const monthParam = typeof sp.month === "string" ? Number.parseInt(sp.month, 10) : defaultMonth;
  const propertyIdParam =
    typeof sp.propertyId === "string" && sp.propertyId ? sp.propertyId : undefined;

  const year = Number.isNaN(yearParam) ? defaultYear : yearParam;
  const month = Number.isNaN(monthParam) ? defaultMonth : Math.max(1, Math.min(12, monthParam));

  const [data, propertyOptions] = await Promise.all([
    getCalendarData({
      organizationId,
      propertyId: propertyIdParam,
      year,
      month,
    }),
    getPropertyOptions(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kalender Okupansi
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Visualisasi ketersediaan kamar, reservasi lintas saluran, dan deteksi otomatis bentrok
            jadwal (double-booking).
          </p>
        </div>
      </header>

      <CalendarView
        data={data}
        propertyOptions={propertyOptions}
        selectedPropertyId={propertyIdParam}
      />
    </div>
  );
}
