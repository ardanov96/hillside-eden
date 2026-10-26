/**
 * Unit tests untuk deteksi bentrok jadwal Dashboard Ringkasan & Kesegaran Data (docs/07 §3.1).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    calendarBlock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    importBatch: {
      findFirst: vi.fn(),
    },
    importItem: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { fromStayDate } from "@/lib/dates";
import { getDashboardCollisions, getDashboardFreshness } from "@/server/queries/dashboard";

describe("getDashboardCollisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan hasCollisions: false saat tidak ada jadwal yang bertabrakan", async () => {
    vi.mocked(prisma.unit.findMany).mockResolvedValue([
      {
        id: "unit-1",
        name: "Master Villa",
        property: { id: "prop-1", name: "Hillside Eden" },
        inventory: [],
      } as never,
    ]);

    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    const result = await getDashboardCollisions({
      organizationId: "org-1",
    });

    expect(result.hasCollisions).toBe(false);
    expect(result.hasWarnings).toBe(false);
    expect(result.totalIssues).toBe(0);
    expect(result.collisions).toEqual([]);
    expect(result.recommendedCalendarUrl).toBe("/calendar");
  });

  it("mendeteksi bentrok jadwal (double-booking) antara 2 booking terkonfirmasi pada unit yang sama", async () => {
    vi.mocked(prisma.unit.findMany).mockResolvedValue([
      {
        id: "unit-1",
        name: "Cottage 1",
        property: { id: "prop-1", name: "Hillside Eden" },
        inventory: [],
      } as never,
    ]);

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "book-1",
        channel: "AIRBNB",
        externalId: "HM-AIRBNB-01",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-11-10"),
        checkOut: fromStayDate("2026-11-15"),
        units: [{ unitId: "unit-1" }],
        listing: { id: "list-1", name: "Cottage Airbnb", channel: "AIRBNB" },
        guest: { displayName: "John Doe" },
        property: { id: "prop-1", name: "Hillside Eden" },
      } as never,
      {
        id: "book-2",
        channel: "TIKET_COM",
        externalId: "TK-TIKET-99",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-11-12"),
        checkOut: fromStayDate("2026-11-17"),
        units: [{ unitId: "unit-1" }],
        listing: { id: "list-2", name: "Cottage Tiket", channel: "TIKET_COM" },
        guest: { displayName: "Jane Smith" },
        property: { id: "prop-1", name: "Hillside Eden" },
      } as never,
    ]);

    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    const result = await getDashboardCollisions({
      organizationId: "org-1",
      propertyId: "prop-1",
    });

    expect(result.hasCollisions).toBe(true);
    expect(result.totalIssues).toBe(1);
    expect(result.collisions).toHaveLength(1);

    const collision = result.collisions[0];
    expect(collision?.unitName).toBe("Cottage 1");
    expect(collision?.propertyName).toBe("Hillside Eden");
    expect(collision?.overlapStart).toBe("2026-11-12");
    expect(collision?.overlapEnd).toBe("2026-11-15");
    expect(collision?.overlapNights).toBe(3);
    expect(collision?.bookingA.guestName).toBe("John Doe");
    expect(collision?.bookingB?.guestName).toBe("Jane Smith");

    // Rekomendasi URL kalender mengarah langsung ke bulan terjadinya bentrok (November 2026)
    expect(result.recommendedCalendarUrl).toContain("year=2026");
    expect(result.recommendedCalendarUrl).toContain("month=11");
    expect(result.recommendedCalendarUrl).toContain("propertyId=prop-1");
  });

  it("mendeteksi bentrok antara booking terkonfirmasi dengan pemblokiran iCal (BOOKING_VS_BLOCK)", async () => {
    vi.mocked(prisma.unit.findMany).mockResolvedValue([
      {
        id: "unit-2",
        name: "Villa Ubud",
        property: { id: "prop-2", name: "Ubud Hillside" },
        inventory: [],
      } as never,
    ]);

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "book-ubud",
        channel: "TRAVELOKA",
        externalId: "TV-888",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-12-01"),
        checkOut: fromStayDate("2026-12-05"),
        units: [{ unitId: "unit-2" }],
        listing: { id: "list-tv", name: "Traveloka Villa", channel: "TRAVELOKA" },
        guest: { displayName: "Guest Traveloka" },
        property: { id: "prop-2", name: "Ubud Hillside" },
      } as never,
    ]);

    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([
      {
        id: "block-ical",
        listingId: "list-tv",
        startDate: fromStayDate("2026-12-03"),
        endDate: fromStayDate("2026-12-06"),
        summary: "AirDNA / External Airbnb Block",
        source: "ICAL",
        listing: {
          listingUnits: [{ unitId: "unit-2" }],
        },
      } as never,
    ]);

    const result = await getDashboardCollisions({
      organizationId: "org-1",
    });

    expect(result.hasCollisions).toBe(true);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]?.kind).toBe("BOOKING_VS_BLOCK");
    expect(result.collisions[0]?.overlapStart).toBe("2026-12-03");
    expect(result.collisions[0]?.overlapEnd).toBe("2026-12-05");
    expect(result.collisions[0]?.block?.summary).toBe("AirDNA / External Airbnb Block");
    expect(result.recommendedCalendarUrl).toContain("year=2026&month=12");
  });
});

describe("getDashboardFreshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghitung kesegaran sumber OTA dan jumlah item karantina", async () => {
    const recentDate = new Date();
    const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 3 hari lalu

    vi.mocked(prisma.importBatch.findFirst).mockImplementation(((args: {
      where?: { channel?: string };
    }) => {
      const ch = args?.where?.channel;
      if (ch === "AIRBNB") {
        return Promise.resolve({ receivedAt: recentDate });
      }
      if (ch === "TIKET_COM") {
        return Promise.resolve({ receivedAt: oldDate });
      }
      return Promise.resolve(null);
    }) as never);

    vi.mocked(prisma.calendarBlock.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.importItem.count).mockResolvedValue(3);

    const result = await getDashboardFreshness("org-1");

    expect(result.needsReviewCount).toBe(3);
    expect(result.sources).toHaveLength(6);

    const airbnb = result.sources.find((s) => s.channel === "AIRBNB");
    expect(airbnb?.status).toBe("fresh");

    const tiket = result.sources.find((s) => s.channel === "TIKET_COM");
    expect(tiket?.status).toBe("stale");

    const traveloka = result.sources.find((s) => s.channel === "TRAVELOKA");
    expect(traveloka?.status).toBe("no_data");
  });
});
