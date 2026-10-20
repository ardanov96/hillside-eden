/**
 * Unit test untuk resolveListing (S2-02.4).
 * Pakai in-memory fake DB (tidak perlu Postgres).
 */
import { describe, expect, it } from "vitest";
import { resolveListing, type ListingResolverDb } from "@/ingest/pipeline/listing-resolver";
import type { NormalizedBooking } from "@/adapters/types";

type ListingRow = {
  id: string;
  propertyId: string;
  organizationId: string;
  channel: import("@/adapters/types").ChannelCode;
  externalId: string;
};

function makeFakeDb(listings: ListingRow[]): ListingResolverDb {
  return {
    listing: {
      async findFirst({ where }) {
        const row = listings.find(
          (l) =>
            l.organizationId === where.organizationId &&
            l.channel === where.channel &&
            l.externalId === where.externalId,
        );
        return row
          ? { id: row.id, propertyId: row.propertyId, organizationId: row.organizationId }
          : null;
      },
      async findUnique({ where }) {
        const row = listings.find((l) => l.id === where.id);
        return row
          ? { id: row.id, propertyId: row.propertyId, organizationId: row.organizationId }
          : null;
      },
    },
  };
}

const ORG = "org-1";
function bnb(partial: Partial<NormalizedBooking> = {}): NormalizedBooking {
  return {
    channel: "AIRBNB",
    externalId: "HM0001",
    externalListingId: "AIRBNB-LISTING-1",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    currency: "IDR",
    grossAmount: "1500000",
    ...partial,
  };
}

function manual(partial: Partial<NormalizedBooking> = {}): NormalizedBooking {
  return {
    channel: "MANUAL",
    externalId: "MAN-001",
    status: "CONFIRMED",
    checkIn: "2026-10-25",
    checkOut: "2026-10-27",
    currency: "IDR",
    grossAmount: "1500000",
    ...partial,
  };
}

describe("resolveListing (OTA path)", () => {
  it("resolved ketika Listing ada", async () => {
    const db = makeFakeDb([
      {
        id: "L1",
        propertyId: "P1",
        organizationId: ORG,
        channel: "AIRBNB",
        externalId: "AIRBNB-LISTING-1",
      },
    ]);
    const res = await resolveListing(db, { organizationId: ORG, booking: bnb() });
    expect(res.kind).toBe("resolved");
    if (res.kind === "resolved") {
      expect(res.listingId).toBe("L1");
      expect(res.propertyId).toBe("P1");
      expect(res.channel).toBe("AIRBNB");
    }
  });

  it("needsReview 'listing-not-found' bila tidak ada", async () => {
    const db = makeFakeDb([]);
    const res = await resolveListing(db, { organizationId: ORG, booking: bnb() });
    expect(res.kind).toBe("needsReview");
    if (res.kind === "needsReview") {
      expect(res.reason).toBe("listing-not-found");
      expect(res.details).toMatchObject({
        channel: "AIRBNB",
        externalListingId: "AIRBNB-LISTING-1",
      });
    }
  });

  it("needsReview bila externalListingId maupun listingName kosong", async () => {
    const db = makeFakeDb([]);
    const e = bnb();
    delete e.externalListingId;
    delete e.listingName;
    const res = await resolveListing(db, { organizationId: ORG, booking: e });
    expect(res.kind).toBe("needsReview");
    if (res.kind === "needsReview") {
      expect(res.reason).toBe("listing-not-found");
    }
  });

  it("fallback ke listingName bila externalListingId tidak ada", async () => {
    const db = makeFakeDb([
      {
        id: "L9",
        propertyId: "P9",
        organizationId: ORG,
        channel: "AIRBNB",
        externalId: "Villa Indah",
      },
    ]);
    const e = bnb({ externalListingId: undefined, listingName: "Villa Indah" });
    const res = await resolveListing(db, { organizationId: ORG, booking: e });
    expect(res.kind).toBe("resolved");
  });

  it("isolasi antar-organization: Listing milih org lain tidak diambil", async () => {
    const db = makeFakeDb([
      {
        id: "L-OTHER",
        propertyId: "P-X",
        organizationId: "org-other",
        channel: "AIRBNB",
        externalId: "AIRBNB-LISTING-1",
      },
    ]);
    const res = await resolveListing(db, { organizationId: ORG, booking: bnb() });
    expect(res.kind).toBe("needsReview");
  });
});

describe("resolveListing (MANUAL path)", () => {
  it("resolved ketika listingId valid milik org", async () => {
    const db = makeFakeDb([
      {
        id: "L-MAN",
        propertyId: "P-MAN",
        organizationId: ORG,
        channel: "MANUAL",
        externalId: "manual-external",
      },
    ]);
    const res = await resolveListing(db, {
      organizationId: ORG,
      booking: manual(),
      options: { listingId: "L-MAN" },
    });
    expect(res.kind).toBe("resolved");
    if (res.kind === "resolved") {
      expect(res.listingId).toBe("L-MAN");
      expect(res.channel).toBe("MANUAL");
    }
  });

  it("needsReview bila listingId tidak disediakan", async () => {
    const db = makeFakeDb([]);
    const res = await resolveListing(db, {
      organizationId: ORG,
      booking: manual(),
    });
    expect(res.kind).toBe("needsReview");
    if (res.kind === "needsReview") {
      expect(res.reason).toBe("manual-listing-missing");
    }
  });

  it("needsReview bila listingId bukan milik organisasi", async () => {
    const db = makeFakeDb([
      {
        id: "L-OTHER",
        propertyId: "P-X",
        organizationId: "org-other",
        channel: "MANUAL",
        externalId: "x",
      },
    ]);
    const res = await resolveListing(db, {
      organizationId: ORG,
      booking: manual(),
      options: { listingId: "L-OTHER" },
    });
    expect(res.kind).toBe("needsReview");
  });

  it("needsReview bila listingId tidak ditemukan di DB", async () => {
    const db = makeFakeDb([]);
    const res = await resolveListing(db, {
      organizationId: ORG,
      booking: manual(),
      options: { listingId: "ghost" },
    });
    expect(res.kind).toBe("needsReview");
    if (res.kind === "needsReview") {
      expect(res.reason).toBe("manual-listing-missing");
    }
  });
});
