/**
 * Unit test untuk getMonthlyOwnerReport dan getPeriodLockList (S8-01).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Decimal } from "@/lib/decimal";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
    },
    otherIncome: {
      findMany: vi.fn(),
    },
    periodLock: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getMonthlyOwnerReport, getPeriodLockList } from "@/server/queries/reports";

describe("getMonthlyOwnerReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghitung metrik finansial, okupansi, saluran OTA, dan kategori beban operasional", async () => {
    // 1. Mock Properties
    const mockProperties = [
      {
        id: "prop-1",
        name: "Hillside Eden",
        units: [
          { id: "u-1", name: "Villa Utama" },
          { id: "u-2", name: "Cottage A" },
        ],
      },
    ];

    // 2. Mock Bookings
    const mockBookings = [
      {
        id: "b-1",
        propertyId: "prop-1",
        channel: "AIRBNB",
        grossAmount: new Decimal("10000000"),
        commissionAmount: new Decimal("1400000"),
        commissionRate: new Decimal("0.14"),
        commissionBasis: "ACTUAL",
        checkIn: new Date("2026-10-05T00:00:00Z"),
        checkOut: new Date("2026-10-10T00:00:00Z"), // 5 nights
        status: "CONFIRMED",
        property: { id: "prop-1", name: "Hillside Eden" },
      },
      {
        id: "b-2",
        propertyId: "prop-1",
        channel: "TIKET_COM",
        grossAmount: new Decimal("5000000"),
        commissionAmount: new Decimal("750000"),
        commissionRate: new Decimal("0.15"),
        commissionBasis: "ESTIMATED",
        checkIn: new Date("2026-10-12T00:00:00Z"),
        checkOut: new Date("2026-10-15T00:00:00Z"), // 3 nights
        status: "CONFIRMED",
        property: { id: "prop-1", name: "Hillside Eden" },
      },
    ];

    // 3. Mock Expenses
    const mockExpenses = [
      {
        id: "exp-1",
        amount: new Decimal("3000000"),
        status: "VERIFIED",
        propertyId: "prop-1",
        category: { code: "SALARY", name: "Gaji & Tunjangan" },
        allocations: [],
      },
      {
        id: "exp-2",
        amount: new Decimal("1000000"),
        status: "VERIFIED",
        propertyId: "prop-1",
        category: { code: "UTILITIES", name: "Utilitas" },
        allocations: [],
      },
    ];

    vi.mocked(prisma.property.findMany).mockResolvedValue(mockProperties as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue(mockExpenses as never);
    vi.mocked(prisma.otherIncome.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.periodLock.findUnique).mockResolvedValue(null as never);

    const report = await getMonthlyOwnerReport({
      organizationId: "org-1",
      year: 2026,
      month: 10,
    });

    // Gross = 10M + 5M = 15.000.000
    expect(report.kpis.gross).toBe("15000000");

    // Commission = 1.4M + 750K = 2.150.000
    expect(report.kpis.commission).toBe("2150000");

    // Net = 15.000.000 - 2.150.000 = 12.850.000
    expect(report.kpis.net).toBe("12850000");

    // Expenses = 3M + 1M = 4.000.000
    expect(report.kpis.expenses).toBe("4000000");

    // Operational Result = 12.850.000 - 4.000.000 = 8.850.000
    expect(report.kpis.operationalResult).toBe("8850000");

    // Sold Nights = 5 + 3 = 8
    expect(report.kpis.soldNights).toBe(8);

    // Available Nights in October (31 days * 2 units) = 62
    expect(report.kpis.availableNights).toBe(62);

    // Channels
    expect(report.channels).toHaveLength(2);
    const airbnb = report.channels.find((c) => c.channel === "AIRBNB");
    expect(airbnb?.gross).toBe("10000000");
    expect(airbnb?.net).toBe("8600000");
    expect(airbnb?.hasEstimated).toBe(false);

    const tiket = report.channels.find((c) => c.channel === "TIKET_COM");
    expect(tiket?.hasEstimated).toBe(true);

    // Expense Categories
    expect(report.expenseCategories).toHaveLength(2);
    const salary = report.expenseCategories.find((c) => c.categoryCode === "SALARY");
    expect(salary?.amount).toBe("3000000");
    expect(salary?.percentageOfTotal).toBe(75); // 3M / 4M

    // Period Lock status
    expect(report.lock.isLocked).toBe(false);
    expect(report.lock.canLock).toBe(true);
    expect(report.lock.variance).toBeNull();
  });

  it("mendeteksi pengeluaran DRAFT dan memblokir tutup buku", async () => {
    const mockProperties = [
      { id: "prop-1", name: "Hillside Eden", units: [{ id: "u-1", name: "Villa" }] },
    ];
    const mockExpenses = [
      {
        id: "exp-draft",
        amount: new Decimal("500000"),
        status: "DRAFT",
        propertyId: "prop-1",
        category: { code: "MISC", name: "Lain-lain" },
        allocations: [],
      },
    ];

    vi.mocked(prisma.property.findMany).mockResolvedValue(mockProperties as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue(mockExpenses as never);
    vi.mocked(prisma.otherIncome.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.periodLock.findUnique).mockResolvedValue(null as never);

    const report = await getMonthlyOwnerReport({
      organizationId: "org-1",
      year: 2026,
      month: 10,
    });

    expect(report.lock.isLocked).toBe(false);
    expect(report.lock.canLock).toBe(false);
    expect(report.lock.unmetRequirements[0]).toContain("DRAFT yang belum diverifikasi");
  });

  it("menghitung variansi sejak penutupan bila buku telah terkunci", async () => {
    const mockProperties = [
      { id: "prop-1", name: "Hillside Eden", units: [{ id: "u-1", name: "Villa" }] },
    ];

    // Live Booking saat ini: Rp 12.000.000 (ada penambahan Rp 2.000.000 pasca tutup buku)
    const mockLiveBookings = [
      {
        id: "b-live",
        propertyId: "prop-1",
        channel: "AIRBNB",
        grossAmount: new Decimal("12000000"),
        commissionAmount: new Decimal("1680000"),
        commissionRate: new Decimal("0.14"),
        commissionBasis: "ACTUAL",
        checkIn: new Date("2026-10-01T00:00:00Z"),
        checkOut: new Date("2026-10-05T00:00:00Z"),
        status: "CONFIRMED",
        property: { id: "prop-1", name: "Hillside Eden" },
      },
    ];

    // Snapshot saat penutupan buku sebelumnya: Gross 10.000.000, Comm 1.400.000, Net 8.600.000, Exp 2.000.000, OpResult 6.600.000
    const mockPeriodLock = {
      id: "lock-1",
      period: new Date("2026-10-01T00:00:00Z"),
      lockedAt: new Date("2026-10-31T23:59:59Z"),
      lockedById: "user-owner",
      snapshot: {
        gross: "10000000",
        commission: "1400000",
        net: "8600000",
        expenses: "2000000",
        operationalResult: "6600000",
        soldNights: 4,
        occupancyRate: 12.9,
      },
    };

    vi.mocked(prisma.property.findMany).mockResolvedValue(mockProperties as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue(mockLiveBookings as never);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: "exp-1",
        amount: new Decimal("2000000"),
        status: "VERIFIED",
        propertyId: "prop-1",
        category: { code: "SALARY", name: "Gaji" },
        allocations: [],
      },
    ] as never);
    vi.mocked(prisma.otherIncome.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.periodLock.findUnique).mockResolvedValue(mockPeriodLock as never);

    const report = await getMonthlyOwnerReport({
      organizationId: "org-1",
      year: 2026,
      month: 10,
    });

    expect(report.lock.isLocked).toBe(true);
    expect(report.lock.variance?.hasVariance).toBe(true);
    // Selisih Gross = 12M - 10M = 2.000.000
    expect(report.lock.variance?.grossDiff).toBe("2000000");
    // Selisih Komisi = 1.68M - 1.4M = 280.000
    expect(report.lock.variance?.commissionDiff).toBe("280000");
    // Selisih Net = 10.32M - 8.6M = 1.720.000
    expect(report.lock.variance?.netDiff).toBe("1720000");
  });
});

describe("getPeriodLockList", () => {
  it("mengembalikan riwayat periode 12 bulan dengan status kunci", async () => {
    vi.mocked(prisma.periodLock.findMany).mockResolvedValue([
      {
        id: "pl-1",
        period: new Date(Date.UTC(2026, 8, 1)), // September 2026
        lockedAt: new Date(),
        lockedById: "user-1",
      },
    ] as never);

    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        incurredOn: new Date(Date.UTC(2026, 9, 15)), // Oktober 2026
      },
    ] as never);

    const list = await getPeriodLockList({ organizationId: "org-1" });
    expect(list).toHaveLength(12);

    const sept = list.find((item) => item.period === "2026-09");
    if (sept) {
      expect(sept.isLocked).toBe(true);
    }
  });
});
