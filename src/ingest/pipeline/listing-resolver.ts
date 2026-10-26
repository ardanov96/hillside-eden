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
        externalId?: string;
        name?: string;
      };
      select?: {
        id?: true;
        propertyId?: true;
        organizationId?: true;
      };
    }): Promise<{ id: string; propertyId: string; organizationId: string } | null>;
    findMany?(args: {
      where: {
        organizationId: string;
        channel: ChannelCode;
      };
      select?: {
        id?: true;
        propertyId?: true;
        organizationId?: true;
        name?: true;
        externalId?: true;
      };
    }): Promise<
      Array<{
        id: string;
        propertyId: string;
        organizationId: string;
        name?: string;
        externalId?: string;
      }>
    >;
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
 * - OTA (CSV/email/ical):
 *   1. cari Listing by (organizationId, channel, externalListingId).
 *   2. cari Listing by (organizationId, channel, name: booking.listingName) (docs/06 §6).
 *   3. fallback: jika hanya ada 1 listing aktif untuk channel ini di org, cocokkan.
 *   4. fallback: fuzzy keyword match nama properti/listing.
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

  // 1. Cari berdasarkan externalId
  let found = await db.listing.findFirst({
    where: { organizationId, channel, externalId: externalListingId },
    select: { id: true, propertyId: true, organizationId: true },
  });

  // 2. Fallback: cari berdasarkan nama persis (docs/06 §6)
  if (!found && booking.listingName) {
    found = await db.listing.findFirst({
      where: { organizationId, channel, name: booking.listingName },
      select: { id: true, propertyId: true, organizationId: true },
    });
  }

  // 3. Fallback: jika findMany didukung, cek apakah hanya ada 1 listing atau ada keyword match
  if (!found && db.listing.findMany) {
    const channelListings = await db.listing.findMany({
      where: { organizationId, channel },
      select: { id: true, propertyId: true, organizationId: true, name: true, externalId: true },
    });
    if (channelListings.length === 1) {
      found = channelListings[0]!;
    } else if (channelListings.length > 1 && booking.listingName) {
      const searchTarget = booking.listingName.toLowerCase();
      const tokens = searchTarget.split(/[\s\-–—,/]+/).filter((w) => w.length >= 4);
      let bestMatch: (typeof channelListings)[0] | null = null;
      let highestScore = 0;

      for (const l of channelListings) {
        const lName = (l.name ?? "").toLowerCase();
        let score = 0;
        if (lName && (searchTarget.includes(lName) || lName.includes(searchTarget))) {
          score += 10;
        }
        for (const t of tokens) {
          if (lName.includes(t)) {
            score += 1;
          }
        }
        if (score > highestScore) {
          highestScore = score;
          bestMatch = l;
        }
      }

      if (bestMatch && highestScore > 0) {
        found = bestMatch;
      }
    }
  }

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
