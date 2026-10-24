/**
 * Unit test untuk query Perlu Perhatian / Karantina (S9-03).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importItem: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAttentionItems } from "@/server/queries/attention";

describe("getAttentionItems (S9-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan item karantina dan menghitung jumlah item needsReview dan failed", async () => {
    vi.mocked(prisma.importItem.count)
      .mockResolvedValueOnce(2 as never) // needsReview
      .mockResolvedValueOnce(1 as never); // failed

    vi.mocked(prisma.importItem.findMany).mockResolvedValue([
      {
        id: "item-1",
        batchId: "batch-1",
        status: "NEEDS_REVIEW",
        errorCode: "UNKNOWN_LISTING",
        errorMessage: "Listing tidak ditemukan",
        contentHash: "hash-1",
        rawRef: null,
        batch: {
          id: "batch-1",
          kind: "CSV",
          channel: "AIRBNB",
          filename: "reservations.csv",
          receivedAt: new Date("2026-10-24T10:00:00Z"),
        },
        parsedPayload: {
          booking: {
            externalId: "HM12345",
            channel: "AIRBNB",
            guestName: "John Doe",
            checkIn: "2026-11-01",
            checkOut: "2026-11-05",
            grossAmount: "5000000",
            currency: "IDR",
            listingName: "Hillside Villa Unknown",
          },
        },
      },
      {
        id: "item-2",
        batchId: "batch-1",
        status: "FAILED",
        errorCode: "UNSUPPORTED_FORMAT",
        errorMessage: "Format CSV rusak",
        contentHash: "hash-2",
        rawRef: null,
        batch: {
          id: "batch-1",
          kind: "CSV",
          channel: null,
          filename: "bad.csv",
          receivedAt: new Date("2026-10-24T09:00:00Z"),
        },
        parsedPayload: null,
      },
    ] as never);

    const result = await getAttentionItems("org-1");

    expect(result.counts.needsReview).toBe(2);
    expect(result.counts.failed).toBe(1);
    expect(result.counts.total).toBe(3);
    expect(result.items).toHaveLength(2);

    const first = result.items[0]!;
    expect(first.status).toBe("NEEDS_REVIEW");
    expect(first.errorCode).toBe("UNKNOWN_LISTING");
    expect(first.bookingDetails?.externalId).toBe("HM12345");
    expect(first.bookingDetails?.guestName).toBe("John Doe");
    expect(first.bookingDetails?.listingName).toBe("Hillside Villa Unknown");

    const second = result.items[1]!;
    expect(second.status).toBe("FAILED");
    expect(second.bookingDetails).toBeNull();
  });
});
