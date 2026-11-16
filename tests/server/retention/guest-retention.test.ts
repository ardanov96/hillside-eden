/**
 * Unit test untuk sweep retensi & privasi data tamu (P2-8).
 * Menguji anonimisasi guest, sweep rawPayload/parsedPayload, dan hapus blob.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
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
    $transaction: vi.fn((callback) => callback(mockPrisma)),
    $disconnect: vi.fn(),
  };
  return { prisma: mockPrisma };
});

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
import { sweepExpiredGuestData } from "@/server/retention/guest-retention";

const NOW = new Date("2026-11-16T00:00:00.000Z");

describe("sweepExpiredGuestData (P2-8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan nol bila tidak ada tamu yang kadaluarsa", async () => {
    vi.mocked(prisma.guest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importItem.updateMany).mockResolvedValue({ count: 0 });

    const res = await sweepExpiredGuestData({ now: NOW });

    expect(res.scannedCount).toBe(0);
    expect(res.anonymizedCount).toBe(0);
    expect(res.payloadSweptCount).toBe(0);
    expect(res.blobDeletedCount).toBe(0);
  });

  it("anonimkan tamu kadaluarsa dan buang rawPayload booking terkait", async () => {
    const guest = {
      id: "guest-1",
      organizationId: "org-1",
      displayName: "Tamu Asli",
      countryCode: "ID",
      retentionUntil: new Date("2026-10-01"),
      createdAt: NOW,
    } as never;
    vi.mocked(prisma.guest.findMany).mockResolvedValue([guest]);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importItem.updateMany).mockResolvedValue({ count: 0 });

    const res = await sweepExpiredGuestData({
      now: NOW,
      organizationId: "org-1",
    });

    expect(res.scannedCount).toBe(1);
    expect(res.anonymizedCount).toBe(1);
    expect(res.payloadSweptCount).toBe(2);

    // Guest di-anonimkan
    expect(prisma.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-1" },
      data: {
        displayName: "Tamu Teranonimkan (UU PDP)",
        countryCode: null,
      },
    });

    // rawPayload booking dibuang
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { guestId: "guest-1", rawPayload: { not: expect.anything() } },
      data: { rawPayload: expect.anything() },
    });
  });

  it("menghapus blob storageKey batch impor yang kadaluarsa", async () => {
    vi.mocked(prisma.guest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([
      {
        id: "batch-1",
        storageKey: "csv-imports/abc.csv",
        organizationId: "org-1",
      } as never,
    ]);
    vi.mocked(prisma.importBatch.update).mockResolvedValue({} as never);
    vi.mocked(prisma.importItem.updateMany).mockResolvedValue({ count: 0 });

    const res = await sweepExpiredGuestData({ now: NOW });

    expect(res.blobDeletedCount).toBe(1);
    expect(prisma.importBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: { storageKey: null },
    });
  });

  it("sweep parsedPayload pada item impor batch yang kadaluarsa", async () => {
    vi.mocked(prisma.guest.findMany).mockResolvedValue([]);
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([
      { id: "batch-1", storageKey: null, organizationId: "org-1" } as never,
    ]);
    vi.mocked(prisma.importItem.updateMany).mockResolvedValue({ count: 4 });

    const res = await sweepExpiredGuestData({ now: NOW });

    expect(res.payloadSweptCount).toBe(4);
    expect(prisma.importItem.updateMany).toHaveBeenCalledWith({
      where: {
        batchId: { in: ["batch-1"] },
        parsedPayload: { not: expect.anything() },
      },
      data: { parsedPayload: expect.anything() },
    });
  });
});
