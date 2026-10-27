/**
 * Halaman Utama Laporan Pemilik & Tutup Buku (S8-01).
 *
 * Mengikuti spesifikasi:
 * - docs/07-ui-spec.md §3.6 (Laporan & Tutup Buku)
 * - docs/05-business-rules.md §7 (Snapshot & Penutupan Periode)
 */
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseGlobalFilter } from "@/lib/filters/global-filter";
import { todayInWITA } from "@/lib/dates";
import { getMonthlyOwnerReport, getPeriodLockList } from "@/server/queries/reports";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Laporan Pemilik - Hillside Eden" };
export const instant = false;

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await connection();
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const gf = parseGlobalFilter(rawParams, todayInWITA());

  let year = Number(rawParams.year);
  let month = Number(rawParams.month);

  if ((!year || !month) && gf.range?.start) {
    const [y, m] = gf.range.start.split("-");
    if (!year && y) year = Number.parseInt(y, 10);
    if (!month && m) month = Number.parseInt(m, 10);
  }

  const now = new Date();
  if (!year) year = now.getFullYear();
  if (!month) month = now.getMonth() + 1;

  const propertyId =
    typeof rawParams.propertyId === "string" && rawParams.propertyId
      ? rawParams.propertyId
      : (gf.propertyId ?? null);

  const [report, periodsList, properties] = await Promise.all([
    getMonthlyOwnerReport({
      organizationId: session.user.organizationId,
      propertyId,
      year,
      month,
    }),
    getPeriodLockList({
      organizationId: session.user.organizationId,
    }),
    prisma.property.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ReportsView
      report={report}
      periodsList={periodsList}
      properties={properties}
      currentYear={year}
      currentMonth={month}
      currentPropertyId={propertyId}
    />
  );
}
