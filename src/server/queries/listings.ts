/**
 * Query server untuk dropdown Listing (S2-04.2, dipakai juga oleh S2-07).
 *
 * Semua query di folder ini wajib Called dari Server Component atau
 * Server Action (bukan Client Component) karena memakai Prisma.
 */
import { prisma } from "@/lib/prisma";

export interface ListingOption {
  id: string;
  label: string;
  propertyId: string;
  propertyName: string;
  channel: string;
  externalId: string;
  unitCount: number;
}

/**
 * Ambil daftar Listing milik organisasi untuk form booking manual.
 * Default: hanya listing aktif. Diurutkan nama listing agar stabil.
 */
export async function getListingOptions(
  organizationId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ListingOption[]> {
  const rows = await prisma.listing.findMany({
    where: {
      organizationId,
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      name: true,
      channel: true,
      externalId: true,
      propertyId: true,
      property: { select: { name: true } },
      _count: { select: { listingUnits: true } },
    },
    orderBy: { name: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    label: `${r.name} - ${r.property.name}`,
    propertyId: r.propertyId,
    propertyName: r.property.name,
    channel: r.channel,
    externalId: r.externalId,
    unitCount: r._count.listingUnits,
  }));
}

/**
 * Ambil daftar properti milik organisasi (untuk filter di halaman bookings).
 */
export async function getPropertyOptions(
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  return prisma.property.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
