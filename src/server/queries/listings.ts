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

import { decryptText, maskIcalUrl } from "@/lib/crypto";

export interface ListingDetailItem {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  channel: string;
  externalId: string;
  url: string | null;
  currency: string;
  isActive: boolean;
  units: Array<{
    id: string;
    name: string;
    kind: string;
    allocationWeight: string | null;
  }>;
  icalFeed: {
    id: string;
    maskedUrl: string;
    rawUrl: string;
    lastFetchedAt: Date | null;
    lastStatus: string | null;
  } | null;
  calendarBlocksCount: number;
}

/**
 * Ambil daftar lengkap listing beserta relasi unit dan feed iCal untuk halaman Pengaturan (S9-02).
 */
export async function getListingsWithDetails(organizationId: string): Promise<ListingDetailItem[]> {
  const rows = await prisma.listing.findMany({
    where: { organizationId },
    include: {
      property: { select: { id: true, name: true } },
      listingUnits: {
        include: {
          unit: { select: { id: true, name: true, kind: true } },
        },
      },
      icalFeeds: {
        take: 1,
        orderBy: { updatedAt: "desc" },
      },
      _count: {
        select: { calendarBlocks: true },
      },
    },
    orderBy: [{ property: { name: "asc" } }, { channel: "asc" }, { name: "asc" }],
  });

  return rows.map((r) => {
    const feed = r.icalFeeds[0] ?? null;
    let rawUrl = "";
    let maskedUrl = "";
    if (feed) {
      rawUrl = decryptText(feed.urlEncrypted);
      maskedUrl = maskIcalUrl(rawUrl);
    }

    return {
      id: r.id,
      name: r.name,
      propertyId: r.propertyId,
      propertyName: r.property.name,
      channel: r.channel,
      externalId: r.externalId,
      url: r.url,
      currency: r.currency,
      isActive: r.isActive,
      units: r.listingUnits.map((lu) => ({
        id: lu.unit.id,
        name: lu.unit.name,
        kind: lu.unit.kind,
        allocationWeight: lu.allocationWeight ? lu.allocationWeight.toString() : null,
      })),
      icalFeed: feed
        ? {
            id: feed.id,
            maskedUrl,
            rawUrl,
            lastFetchedAt: feed.lastFetchedAt,
            lastStatus: feed.lastStatus,
          }
        : null,
      calendarBlocksCount: r._count.calendarBlocks,
    };
  });
}
