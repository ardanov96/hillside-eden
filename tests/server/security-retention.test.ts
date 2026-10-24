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
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        guest: {
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      }),
    ),
  },
}));

import { prisma } from "@/lib/prisma";
import { sweepExpiredGuestData, ANONYMIZED_GUEST_NAME } from "@/server/retention/guest-retention";

describe("sweepExpiredGuestData (UU PDP)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
