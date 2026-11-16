/**
 * Unit test untuk modul Retensi Tamu & Pengerasan Keamanan (S8-04).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      updateMany: vi.fn(),
    },
    importBatch: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    importItem: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        guest: {
          update: vi.fn(),
        },
        booking: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        auditLog: {
          create: vi.fn(),
        },
      }),
    ),
  },
}));

vi.mock("@/ingest/storage", () => ({
  createStorageProvider: vi.fn().mockReturnValue({
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/ingest/pipeline/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    guestAnonymized: "guest.anonymized",
  },
}));

import { prisma } from "@/lib/prisma";
import { sweepExpiredGuestData, ANONYMIZED_GUEST_NAME } from "@/server/retention/guest-retention";

describe("sweepExpiredGuestData (UU PDP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importItem.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 });
  });

  it("menganonimkan data tamu yang telah melewati batas retentionUntil", async () => {
    const expiredGuest = {
      id: "guest-1",
      organizationId: "org-1",
      displayName: "John Doe",
      countryCode: "US",
      retentionUntil: new Date("2026-01-01T00:00:00Z"),
    };

    vi.mocked(prisma.guest.findMany).mockResolvedValue([expiredGuest] as never);

    const result = await sweepExpiredGuestData({
      organizationId: "org-1",
      now: new Date("2026-10-24T00:00:00Z"),
    });

    expect(result.scannedCount).toBe(1);
    expect(result.anonymizedCount).toBe(1);
    expect(ANONYMIZED_GUEST_NAME).toBe("Tamu Teranonimkan (UU PDP)");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("mengabaikan tamu yang belum melewati batas retensi atau sudah teranonimkan", async () => {
    vi.mocked(prisma.guest.findMany).mockResolvedValue([] as never);

    const result = await sweepExpiredGuestData({
      organizationId: "org-1",
      now: new Date("2026-10-24T00:00:00Z"),
    });

    expect(result.scannedCount).toBe(0);
    expect(result.anonymizedCount).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
