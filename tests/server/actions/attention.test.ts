/**
 * Unit test untuk Server Actions Perlu Perhatian / Karantina (S9-03).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    listing: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/server/prisma-tx", () => ({
  withSerializableTransaction: vi.fn(async (_prisma, callback) => {
    const mockTx = {
      importItem: { update: vi.fn() },
    };
    return callback(mockTx);
  }),
}));

vi.mock("@/ingest/pipeline/upsert", () => ({
  applyBookingEvent: vi.fn().mockResolvedValue({
    kind: "created",
    bookingId: "b-1",
    eventId: "e-1",
  }),
}));

vi.mock("@/ingest/pipeline/audit", () => ({
  AUDIT_ACTIONS: {
    importItemReprocessed: "import_item.reprocessed",
    importItemIgnored: "import_item.ignored",
  },
  writeAudit: vi.fn().mockResolvedValue({}),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyBookingEvent } from "@/ingest/pipeline/upsert";
import { revalidatePath } from "next/cache";
import {
  resolveAndReprocessItemAction,
  dismissAttentionItemAction,
} from "@/server/actions/attention";

describe("Attention Server Actions (S9-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveAndReprocessItemAction", () => {
    it("menolak jika user belum login", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await resolveAndReprocessItemAction({
        itemId: "item-1",
        targetListingId: "listing-1",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Sesi tidak valid");
    });

    it("menolak jika item karantina tidak ditemukan", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "u-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.importItem.findFirst).mockResolvedValue(null as never);

      const result = await resolveAndReprocessItemAction({
        itemId: "item-unknown",
        targetListingId: "listing-1",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("tidak ditemukan");
    });

    it("menolak jika target listing tidak ditemukan", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "u-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.importItem.findFirst).mockResolvedValue({
        id: "item-1",
        parsedPayload: {
          booking: {
            externalId: "HM123",
            checkIn: "2026-11-01",
            checkOut: "2026-11-03",
          },
        },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue(null as never);

      const result = await resolveAndReprocessItemAction({
        itemId: "item-1",
        targetListingId: "listing-unknown",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Target listing tidak valid");
    });

    it("berhasil memetakan listing dan memproses ulang item ke database", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "u-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.importItem.findFirst).mockResolvedValue({
        id: "item-1",
        status: "NEEDS_REVIEW",
        errorCode: "UNKNOWN_LISTING",
        parsedPayload: {
          eventType: "CREATED",
          booking: {
            externalId: "HM123",
            channel: "AIRBNB",
            checkIn: "2026-11-01",
            checkOut: "2026-11-03",
            grossAmount: "5000000",
            currency: "IDR",
          },
        },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue({
        id: "listing-target",
        name: "Hillside Villa 1",
        propertyId: "prop-1",
      } as never);

      const result = await resolveAndReprocessItemAction({
        itemId: "item-1",
        targetListingId: "listing-target",
      });

      expect(result.success).toBe(true);
      expect(applyBookingEvent).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/attention");
      expect(revalidatePath).toHaveBeenCalledWith("/bookings");
    });
  });

  describe("dismissAttentionItemAction", () => {
    it("berhasil menandai item sebagai diabaikan", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "u-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.importItem.findFirst).mockResolvedValue({
        id: "item-1",
        status: "FAILED",
        errorCode: "UNSUPPORTED_FORMAT",
      } as never);

      const result = await dismissAttentionItemAction({
        itemId: "item-1",
        reason: "File uji coba",
      });

      expect(result.success).toBe(true);
      expect(prisma.importItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          status: "DUPLICATE",
          errorCode: "DISMISSED",
          errorMessage: "[Diabaikan]: File uji coba",
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/attention");
    });
  });
});
