/**
 * Unit test untuk server queries komisi & rekonsiliasi (S7-01 & S7-03).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Decimal } from "@/lib/decimal";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createCommissionRule, listCommissionRules } from "@/server/queries/commissions";

describe("Commission Rules Query & Mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menolak pembuatan aturan dengan rate negatif atau > 1", async () => {
    await expect(
      createCommissionRule({
        channel: "AIRBNB",
        rate: "1.25", // 125% -> invalid
        validFrom: "2026-01-01",
      }),
    ).rejects.toThrow("Rate komisi harus di antara 0.0000 dan 1.0000");

    await expect(
      createCommissionRule({
        channel: "AIRBNB",
        rate: "-0.05",
        validFrom: "2026-01-01",
      }),
    ).rejects.toThrow("Rate komisi harus di antara 0.0000 dan 1.0000");
  });

  it("menolak pembuatan aturan bila validTo sebelum validFrom", async () => {
    await expect(
      createCommissionRule({
        channel: "AIRBNB",
        rate: "0.15",
        validFrom: "2026-10-01",
        validTo: "2026-09-01",
      }),
    ).rejects.toThrow("tidak boleh mendahului validFrom");
  });

  it("membuat aturan baru dengan audit log dan format persentase", async () => {
    const mockCreated = {
      id: "rule-1",
      channel: "AIRBNB",
      rate: new Decimal("0.1500"),
      collectType: "CHANNEL_COLLECT",
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: null,
      listingId: null,
      notes: "Default Airbnb 15%",
      listing: null,
    };

    vi.mocked(prisma.commissionRule.create).mockResolvedValue(mockCreated as never);

    const result = await createCommissionRule({
      channel: "AIRBNB",
      rate: "0.15",
      collectType: "CHANNEL_COLLECT",
      validFrom: "2026-01-01",
      notes: "Default Airbnb 15%",
      organizationId: "org-1",
    });

    expect(result.channel).toBe("AIRBNB");
    expect(result.ratePercentage).toBe("15.0%");
    expect(result.rate).toBe("0.1500");
    expect(result.collectType).toBe("CHANNEL_COLLECT");
  });

  it("mengambil daftar aturan komisi terformat", async () => {
    const mockRules = [
      {
        id: "rule-1",
        channel: "TIKET_COM",
        rate: new Decimal("0.1500"),
        collectType: "HOTEL_COLLECT",
        validFrom: new Date("2026-01-01T00:00:00Z"),
        validTo: null,
        listingId: "listing-1",
        notes: null,
        listing: {
          name: "Villa Hillside",
          property: { name: "Hillside Eden Main" },
        },
      },
    ];

    vi.mocked(prisma.commissionRule.findMany).mockResolvedValue(mockRules as never);

    const list = await listCommissionRules({ channel: "TIKET_COM" });
    expect(list).toHaveLength(1);
    expect(list[0]?.channel).toBe("TIKET_COM");
    expect(list[0]?.listingName).toBe("Villa Hillside");
    expect(list[0]?.propertyName).toBe("Hillside Eden Main");
    expect(list[0]?.ratePercentage).toBe("15.0%");
  });
});
