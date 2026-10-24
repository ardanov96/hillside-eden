/**
 * Unit test untuk query Kalender Okupansi & Deteksi Bentrok (S10-01).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    calendarBlock: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { fromStayDate } from "@/lib/dates";
import { getCalendarData } from "@/server/queries/calendar";

describe("getCalendarData (S10-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghasilkan struktur kalender dan hari-hari dalam bulan dengan benar (November 2026)", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      {
        id: "prop-1",
        name: "Hillside Eden Main Villa",
        organizationId: "org-1",
        isActive: true,
        units: [
          {
            id: "unit-1",
            name: "Master Suite",
            kind: "ROOM",
            propertyId: "prop-1",
            isActive: true,
            inventory: [],
          },
        ],
      } as never,
    ]);

    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    const result = await getCalendarData({
      organizationId: "org-1",
      year: 2026,
      month: 11,
    });

    expect(result.year).toBe(2026);
    expect(result.month).toBe(11);
    expect(result.monthLabel).toBe("November 2026");
    expect(result.daysInMonth).toHaveLength(30);

    // 1 November 2026 adalah hari Minggu
    expect(result.daysInMonth[0]?.date).toBe("2026-11-01");
    expect(result.daysInMonth[0]?.dayName).toBe("Min");
    expect(result.daysInMonth[0]?.isWeekend).toBe(true);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]?.propertyName).toBe("Hillside Eden Main Villa");
    expect(result.properties[0]?.units).toHaveLength(1);

    const unitRow = result.properties[0]?.units[0];
    expect(unitRow?.unitName).toBe("Master Suite");
    expect(unitRow?.days).toHaveLength(30);
    expect(unitRow?.soldNights).toBe(0);
    expect(unitRow?.availableNights).toBe(30);
    expect(unitRow?.occupancyRate).toBe(0);
  });

  it("memetakan booking aktif ke sel hari dan menghitung okupansi", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      {
        id: "prop-1",
        name: "Hillside Eden",
        organizationId: "org-1",
        isActive: true,
        units: [
          {
            id: "unit-1",
            name: "Villa 1",
            kind: "VILLA",
            propertyId: "prop-1",
            isActive: true,
            inventory: [],
          },
        ],
      } as never,
    ]);

    // Booking menginap 3 malam: 2026-11-10 s/d 2026-11-13 (checkOut)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "book-1",
        organizationId: "org-1",
        channel: "AIRBNB",
        externalId: "HM12345",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-11-10"),
        checkOut: fromStayDate("2026-11-13"),
        grossAmount: "6000000",
        units: [{ unitId: "unit-1" }],
        listing: { id: "list-1", name: "Hillside Villa Airbnb", channel: "AIRBNB" },
        guest: { displayName: "Alice Wonderland" },
      } as never,
    ]);

    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    const result = await getCalendarData({
      organizationId: "org-1",
      year: 2026,
      month: 11,
    });

    const prop = result.properties[0];
    expect(prop).toBeDefined();
    if (!prop || !prop.units[0]) throw new Error("Expected unitRow");
    const unitRow = prop.units[0];
    expect(unitRow.soldNights).toBe(3);
    expect(unitRow.availableNights).toBe(30);
    expect(unitRow.occupancyRate).toBe(10); // 3 / 30 = 10%

    // Tanggal 9 Nov: kosong
    const day9 = unitRow.days.find((d) => d.date === "2026-11-09");
    expect(day9?.booking).toBeNull();

    // Tanggal 10 Nov: First night
    const day10 = unitRow.days.find((d) => d.date === "2026-11-10");
    expect(day10?.booking?.externalId).toBe("HM12345");
    expect(day10?.booking?.channel).toBe("AIRBNB");
    expect(day10?.booking?.guestName).toBe("Alice Wonderland");
    expect(day10?.booking?.isFirstNight).toBe(true);
    expect(day10?.booking?.isLastNight).toBe(false);

    // Tanggal 11 Nov: Middle night
    const day11 = unitRow.days.find((d) => d.date === "2026-11-11");
    expect(day11?.booking?.isFirstNight).toBe(false);
    expect(day11?.booking?.isLastNight).toBe(false);

    // Tanggal 12 Nov: Last night
    const day12 = unitRow.days.find((d) => d.date === "2026-11-12");
    expect(day12?.booking?.isFirstNight).toBe(false);
    expect(day12?.booking?.isLastNight).toBe(true);

    // Tanggal 13 Nov (hari check-out): Tidak dihitung sebagai malam terjual
    const day13 = unitRow.days.find((d) => d.date === "2026-11-13");
    expect(day13?.booking).toBeNull();
  });

  it("mendeteksi bentrok jadwal (double-booking) dan menandai sel kalender", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      {
        id: "prop-1",
        name: "Hillside Eden",
        organizationId: "org-1",
        isActive: true,
        units: [
          {
            id: "unit-1",
            name: "Villa 1",
            kind: "VILLA",
            propertyId: "prop-1",
            isActive: true,
            inventory: [],
          },
        ],
      } as never,
    ]);

    // Dua booking bertabrakan di unit yang sama pada tanggal 2026-11-05 s/d 2026-11-08
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "book-1",
        organizationId: "org-1",
        channel: "AIRBNB",
        externalId: "HM12345",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-11-05"),
        checkOut: fromStayDate("2026-11-08"),
        units: [{ unitId: "unit-1" }],
        listing: { id: "list-1", name: "Airbnb Listing", channel: "AIRBNB" },
        guest: { displayName: "Guest Airbnb" },
      } as never,
      {
        id: "book-2",
        organizationId: "org-1",
        channel: "TIKET_COM",
        externalId: "TIKET999",
        status: "CONFIRMED",
        checkIn: fromStayDate("2026-11-06"),
        checkOut: fromStayDate("2026-11-10"),
        units: [{ unitId: "unit-1" }],
        listing: { id: "list-2", name: "Tiket Listing", channel: "TIKET_COM" },
        guest: { displayName: "Guest Tiket" },
      } as never,
    ]);

    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    const result = await getCalendarData({
      organizationId: "org-1",
      year: 2026,
      month: 11,
    });

    expect(result.collisionReport.hasCollisions).toBe(true);
    expect(result.collisionReport.totalIssues).toBeGreaterThanOrEqual(1);

    const prop = result.properties[0];
    expect(prop).toBeDefined();
    if (!prop || !prop.units[0]) throw new Error("Expected unitRow");
    const unitRow = prop.units[0];
    // Hari ke-6 November terjadi bentrok
    const day6 = unitRow.days.find((d) => d.date === "2026-11-06");
    expect(day6?.collision).toBeDefined();
    expect(day6?.collision?.severity).toBe("COLLISION");
  });

  it("meneruskan filter propertyId ke query Prisma jika diberikan", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([]);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
    vi.mocked(prisma.calendarBlock.findMany).mockResolvedValue([]);

    await getCalendarData({
      organizationId: "org-1",
      propertyId: "prop-99",
      year: 2026,
      month: 11,
    });

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          id: "prop-99",
          isActive: true,
        }),
      }),
    );
  });
});
