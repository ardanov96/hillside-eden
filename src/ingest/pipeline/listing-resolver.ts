/**
 * ListingResolver (S2-02.4).
 *
 * Tujuan: cocokkan NormalizedBooking event ke Listing (dan Property) yang
 * sudah ada; bila tidak ditemukan -> 'needsReview'.
 *
 * Sumber kebenaran: docs/04 (model Listing, unique key
 * (organizationId, channel, externalId)), docs/06 §4 (NEEDS_REVIEW flow).
 *
 * Prinsip:
 * - Murni: yang bergantung pada DB adalah interface minimal. Implementasi
 *   dapat di-mock untuk unit test tanpa prisma.
 * - Untuk MANUAL channel: caller menyediakan listingId secara eksplisit
 *   (dipilih di form S2-04), sehingga resolver hanya memvalidasi milik org.
 * - Untuk OTA channel: lookup Listing by (orgId, channel, externalListingId).
 *   Tidak ditemukan -> NEEDS_REVIEW (lihat docs/06 §4).
 */
import type { NormalizedBooking, ChannelCode } from "@/adapters/types";

/** Abstraksi minimum DB yang dibutuhkan resolver (untuk testing). */
export interface ListingResolverDb {
  listing: {
    findFirst(args: {
      where: {
        organizationId: string;
        channel: ChannelCode;
        externalId: string;
      };
      select?: {
        id?: true;
        propertyId?: true;
        organizationId?: true;
      };
    }): Promise<{ id: string; propertyId: string; organizationId: string } | null>;
    findUnique(args: {
      where: { id: string };
      select?: { id?: true; propertyId?: true; organizationId?: true };
    }): Promise<{ id: string; propertyId: string; organizationId: string } | null>;
  };
}

/** Hasil resolusi listing untuk sebuah event. */
export type ListingResolution =
  | {
      kind: "resolved";
      listingId: string;
      propertyId: string;
      channel: ChannelCode;
    }
  | {
      kind: "needsReview";
      reason: "listing-not-found" | "listing-org-mismatch" | "manual-listing-missing";
      message: string;
      details?: Record<string, unknown>;
    };

export interface ResolveListingOptions {
  /** Wajib untuk MANUAL; diabaikan untuk OTA. */
  listingId?: string;
}

/**
 * Resolusi listing untuk sebuah event.
 *
 * Algoritma:
 * - MANUAL: gunakan options.listingId, validasi milik organizationId.
 * - OTA (CSV/email/ical): cari Listing by (organizationId, channel, externalListingId).
 *   - Ketemu -> resolved.
 *   - Tidak ketemu -> needsReview 'listing-not-found'.
 */
export async function resolveListing(
  db: ListingResolverDb,
  args: {
    organizationId: string;
    booking: NormalizedBooking;
    options?: ResolveListingOptions;
  },
): Promise<ListingResolution> {
  const { organizationId, booking, options = {} } = args;
  const channel = booking.channel;

  if (channel === "MANUAL") {
    const listingId = options.listingId;
    if (!listingId) {
      return {
        kind: "needsReview",
        reason: "manual-listing-missing",
        message: "Channel MANUAL wajib menyediakan listingId dari form.",
        details: { externalId: booking.externalId },
      };
    }
    const found = await db.listing.findUnique({
      where: { id: listingId },
      select: { id: true, propertyId: true, organizationId: true },
    });
    if (!found || found.organizationId !== organizationId) {
      return {
        kind: "needsReview",
        reason: "manual-listing-missing",
        message: "Listing MANUAL tidak ditemukan atau bukan milik organisasi.",
        details: { listingId },
      };
    }
    return {
      kind: "resolved",
      listingId: found.id,
      propertyId: found.propertyId,
      channel,
    };
  }

  // OTA path
  const externalListingId = booking.externalListingId ?? booking.listingName;
  if (!externalListingId) {
    return {
      kind: "needsReview",
      reason: "listing-not-found",
      message: "Event OTA tanpa externalListingId / listingName; tidak dapat mencocokkan Listing.",
      details: { channel, externalId: booking.externalId },
    };
  }

  const found = await db.listing.findFirst({
    where: { organizationId, channel, externalId: externalListingId },
    select: { id: true, propertyId: true, organizationId: true },
  });
  if (!found) {
    return {
      kind: "needsReview",
      reason: "listing-not-found",
      message:
        `Listing untuk ${channel}/${externalListingId} belum di-mapping. ` +
        "Tambahkan Listing dengan externalId yang sesuai melalui halaman Settings.",
      details: { channel, externalListingId },
    };
  }
  return {
    kind: "resolved",
    listingId: found.id,
    propertyId: found.propertyId,
    channel,
  };
}
