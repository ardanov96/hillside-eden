/**
 * Unit test untuk getCashFlowSummary (S7-04).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Decimal } from "@/lib/decimal";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payout: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getCashFlowSummary } from "@/server/queries/cash";

describe("getCashFlowSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghitung kas masuk, kas keluar, arus kas bersih, dan komisi terutang", async () => {
    // 1. Payout OTA (CHANNEL_COLLECT): Rp 5.000.000
    const mockPayouts = [
      {
        id: "payout-1",
        channel: "AIRBNB",
        payoutDate: new Date("2026-10-20T00:00:00Z"),
        currency: "IDR",
        amount: new Decimal("5000000"),
        reference: "PAY-AB-01",
        bookings: [{ id: "b1" }],
      },
    ];

    // 2. Hotel Collect Bookings: Rp 2.000.000 (komisi 15% = 300.000)
    const mockHotelCollect = [
      {
        id: "b2",
        channel: "TIKET_COM",
        grossAmount: new Decimal("2000000"),
        commissionAmount: new Decimal("300000"),
        currency: "IDR",
        collectType: "HOTEL_COLLECT",
        status: "CONFIRMED",
      },
    ];

    // 3. Expenses: Rp 1.500.000
    const mockExpenses = [
      {
        id: "exp-1",
        amount: new Decimal("1500000"),
        paidOn: new Date("2026-10-22T00:00:00Z"),
        status: "VERIFIED",
      },
    ];

    // 4. Pending Bookings: Rp 3.000.000 (komisi 450.000 -> net 2.550.000)
    const mockPending = [
      {
        id: "b3",
        externalId: "HM999",
        channel: "AIRBNB",
        grossAmount: new Decimal("3000000"),
        commissionAmount: new Decimal("450000"),
        currency: "IDR",
        checkOut: new Date("2026-10-18T00:00:00Z"),
        property: { name: "Villa Hillside" },
      },
    ];

    vi.mocked(prisma.payout.findMany).mockResolvedValue(mockPayouts as never);
    vi.mocked(prisma.booking.findMany)
      // Call 1: hotelCollectWhere
      .mockResolvedValueOnce(mockHotelCollect as never)
      // Call 2: allHotelCollect
      .mockResolvedValueOnce(mockHotelCollect as never)
      // Call 3: pendingBookings
      .mockResolvedValueOnce(mockPending as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue(mockExpenses as never);

    const result = await getCashFlowSummary({ organizationId: "org-1" });

    // Kas Masuk = 5.000.000 (payout) + 2.000.000 (hotel collect) = 7.000.000
    expect(result.metrics.totalCashIn).toBe("7000000");
    expect(result.metrics.payoutsReceived).toBe("5000000");
    expect(result.metrics.hotelCollectReceived).toBe("2000000");

    // Kas Keluar = 1.500.000
    expect(result.metrics.totalCashOut).toBe("1500000");

    // Arus Kas Bersih = 7.000.000 - 1.500.000 = 5.500.000
    expect(result.metrics.netCashFlow).toBe("5500000");

    // Komisi Terutang (Hotel Collect) = 300.000
    expect(result.metrics.totalOutstandingCommission).toBe("300000");
    expect(result.outstandingCommissions).toHaveLength(1);
    expect(result.outstandingCommissions[0]?.channel).toBe("TIKET_COM");
    expect(result.outstandingCommissions[0]?.totalCommissionPayable).toBe("300000");

    // Pendapatan Belum Cair = 3.000.000 - 450.000 = 2.550.000
    expect(result.metrics.totalPendingPayout).toBe("2550000");
    expect(result.pendingPayouts).toHaveLength(1);
  });

  it("mengonversi USD ke IDR dengan benar berdasarkan kurs fx", async () => {
    // 1. Payout USD 200 (default kurs 16.000 = 3.200.000)
    const mockPayouts = [
      {
        id: "payout-usd-1",
        channel: "AIRBNB",
        payoutDate: new Date("2026-10-20T00:00:00Z"),
        currency: "USD",
        amount: new Decimal("200"),
        reference: "PAY-USD-01",
        bookings: [{ id: "b-usd-1" }],
      },
    ];

    // 2. Hotel Collect Booking USD 100 dengan fxRateToBase 16.200 (komisi 15 USD = 243.000 IDR)
    const mockHotelCollect = [
      {
        id: "b-usd-2",
        channel: "BOOKING_COM",
        grossAmount: new Decimal("100"),
        commissionAmount: new Decimal("15"),
        currency: "USD",
        fxRateToBase: new Decimal("16200"),
        collectType: "HOTEL_COLLECT",
        status: "CONFIRMED",
      },
    ];

    // 3. Expenses: Rp 0
    const mockExpenses: unknown[] = [];

    // 4. Pending Booking USD 50 (komisi 5 -> net 45 USD, default fx 16000 -> 720.000 IDR)
    const mockPending = [
      {
        id: "b-usd-3",
        externalId: "USD999",
        channel: "AGODA",
        grossAmount: new Decimal("50"),
        commissionAmount: new Decimal("5"),
        currency: "USD",
        fxRateToBase: null,
        checkOut: new Date("2026-10-18T00:00:00Z"),
        property: { name: "Villa Hillside" },
      },
    ];

    vi.mocked(prisma.payout.findMany).mockResolvedValue(mockPayouts as never);
    vi.mocked(prisma.booking.findMany)
      .mockResolvedValueOnce(mockHotelCollect as never)
      .mockResolvedValueOnce(mockHotelCollect as never)
      .mockResolvedValueOnce(mockPending as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue(mockExpenses as never);

    const result = await getCashFlowSummary({ organizationId: "org-1" });

    // Kas Masuk = 200 * 16.000 (3.200.000) + 100 * 16.200 (1.620.000) = 4.820.000
    expect(result.metrics.payoutsReceived).toBe("3200000");
    expect(result.metrics.hotelCollectReceived).toBe("1620000");
    expect(result.metrics.totalCashIn).toBe("4820000");

    // Komisi Terutang (Hotel Collect) = 15 * 16.200 = 243.000
    expect(result.metrics.totalOutstandingCommission).toBe("243000");
    expect(result.outstandingCommissions).toHaveLength(1);
    expect(result.outstandingCommissions[0]?.totalCommissionPayable).toBe("243000");

    // Pendapatan Belum Cair = (50 - 5) * 16.000 = 720.000
    expect(result.metrics.totalPendingPayout).toBe("720000");
  });
});
