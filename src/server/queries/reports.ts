/**
 * Kueri Laporan Bulanan Pemilik dan Tutup Buku (S8-01).
 *
 * Mengikuti spesifikasi:
 * - docs/07-ui-spec.md §3.6 (Laporan & Tutup Buku)
 * - docs/05-business-rules.md §5, §6, §7 (Komisi, Hasil Operasional, Penutupan Buku, Snapshot & Variansi)
 * - docs/04-data-model.md (PeriodLock, AuditLog, Expense, Booking)
 */
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import type { ChannelCode } from "@prisma/client";

export interface ReportKpis {
  gross: string;
  commission: string;
  net: string;
  expenses: string;
  otherIncome: string;
  operationalResult: string;
  effectiveCommissionRate: number; // e.g. 14.5%
  soldNights: number;
  availableNights: number;
  occupancyRate: number; // e.g. 68.5%
  adr: string;
  revpar: string;
  totalBookings: number;
}

export interface ReportChannelBreakdown {
  channel: ChannelCode;
  bookingCount: number;
  gross: string;
  commission: string;
  net: string;
  effectiveRate: number;
  hasEstimated: boolean;
}

export interface ReportExpenseCategoryBreakdown {
  categoryCode: string;
  categoryName: string;
  amount: string;
  percentageOfTotal: number;
  entryCount: number;
  hasDrafts: boolean;
}

export interface ReportPropertyBreakdown {
  propertyId: string;
  propertyName: string;
  gross: string;
  net: string;
  expenses: string;
  operationalResult: string;
  soldNights: number;
  availableNights: number;
  occupancyRate: number;
  adr: string;
}

export interface ReportSnapshot {
  gross: string;
  commission: string;
  net: string;
  expenses: string;
  operationalResult: string;
  soldNights: number;
  occupancyRate: number;
}

export interface ReportVariance {
  grossDiff: string;
  commissionDiff: string;
  netDiff: string;
  expensesDiff: string;
  operationalResultDiff: string;
  hasVariance: boolean;
}

export interface MonthlyOwnerReportDto {
  period: string; // "YYYY-MM"
  year: number;
  month: number;
  periodLabel: string; // e.g. "Oktober 2026"
  propertyFilterName: string;
  kpis: ReportKpis;
  channels: ReportChannelBreakdown[];
  expenseCategories: ReportExpenseCategoryBreakdown[];
  properties: ReportPropertyBreakdown[];
  lock: {
    isLocked: boolean;
    lockedAt: string | null;
    lockedBy: string | null;
    snapshot: ReportSnapshot | null;
    variance: ReportVariance | null;
    canLock: boolean;
    unmetRequirements: string[];
  };
}

export interface PeriodLockListItem {
  period: string; // "YYYY-MM"
  periodLabel: string;
  isLocked: boolean;
  lockedAt: string | null;
  lockedById: string | null;
  draftExpenseCount: number;
  canLock: boolean;
}

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export async function getMonthlyOwnerReport(input: {
  organizationId: string;
  propertyId?: string | null;
  year: number;
  month: number; // 1-12
}): Promise<MonthlyOwnerReportDto> {
  const { organizationId, propertyId, year, month } = input;

  const monthStr = month.toString().padStart(2, "0");
  const period = `${year}-${monthStr}`;
  const periodLabel = `${MONTH_NAMES_ID[month - 1]} ${year}`;

  // Hitung rentang tanggal bulan
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const daysInMonth = endDate.getUTCDate();

  // 1. Ambil informasi organisasi & properti
  const properties = await prisma.property.findMany({
    where: {
      organizationId,
      ...(propertyId ? { id: propertyId } : {}),
      isActive: true,
    },
    include: {
      units: {
        where: { isActive: true },
        select: { id: true, name: true },
      },
    },
  });

  let propertyFilterName = "Semua Properti (Portofolio Gabungan)";
  if (propertyId) {
    const selected = properties.find((p) => p.id === propertyId);
    if (selected) propertyFilterName = selected.name;
  }

  // Hitung kapasitas total room nights tersedia dalam bulan ini
  let totalAvailableNights = 0;
  const propertyAvailableNights: Record<string, number> = {};
  for (const p of properties) {
    const pNights = p.units.length * daysInMonth;
    propertyAvailableNights[p.id] = pNights;
    totalAvailableNights += pNights;
  }

  // 2. Ambil booking yang menginap di bulan ini
  const bookings = await prisma.booking.findMany({
    where: {
      organizationId,
      ...(propertyId ? { propertyId } : {}),
      status: { in: ["CONFIRMED", "PENDING"] },
      // CheckIn sebelum akhir bulan dan CheckOut setelah awal bulan
      checkIn: { lte: endDate },
      checkOut: { gte: startDate },
    },
    include: {
      property: { select: { id: true, name: true } },
    },
  });

  // 3. Ambil pengeluaran bulan ini
  const expenses = await prisma.expense.findMany({
    where: {
      organizationId,
      ...(propertyId ? { propertyId } : {}),
      incurredOn: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: { select: { code: true, name: true } },
      allocations: true,
    },
  });

  // 4. Ambil pendapatan lain (OtherIncome) bulan ini
  const otherIncomes = await prisma.otherIncome.findMany({
    where: {
      organizationId,
      ...(propertyId ? { propertyId } : {}),
      receivedOn: {
        gte: startDate,
        lte: endDate,
      },
      status: "VERIFIED",
    },
  });

  // 5. Cek PeriodLock untuk periode ini
  const periodLock = await prisma.periodLock.findUnique({
    where: {
      organizationId_period: {
        organizationId,
        period: new Date(Date.UTC(year, month - 1, 1)),
      },
    },
  });

  // Kalkulasi Booking & KPI
  let totalGross = new Decimal(0);
  let totalCommission = new Decimal(0);
  let totalSoldNights = 0;

  const channelMap = new Map<
    ChannelCode,
    { count: number; gross: Decimal; commission: Decimal; net: Decimal; hasEstimated: boolean }
  >();

  const propertyStats = new Map<
    string,
    {
      id: string;
      name: string;
      gross: Decimal;
      net: Decimal;
      expenses: Decimal;
      soldNights: number;
    }
  >();

  for (const p of properties) {
    propertyStats.set(p.id, {
      id: p.id,
      name: p.name,
      gross: new Decimal(0),
      net: new Decimal(0),
      expenses: new Decimal(0),
      soldNights: 0,
    });
  }

  for (const b of bookings) {
    const fx =
      b.currency === "USD"
        ? b.fxRateToBase && new Decimal(b.fxRateToBase.toString()).gt(1)
          ? new Decimal(b.fxRateToBase.toString())
          : new Decimal(16000)
        : new Decimal(1);
    const rawGross = new Decimal(b.grossAmount.toString());
    const rawComm = b.commissionAmount
      ? new Decimal(b.commissionAmount.toString())
      : rawGross.times(b.commissionRate ? new Decimal(b.commissionRate.toString()) : 0.15);
    const grossVal = rawGross.times(fx);
    const commVal = rawComm.times(fx);
    const netVal = grossVal.minus(commVal);

    // Hitung malam menginap yang jatuh dalam bulan ini
    const bCheckIn = new Date(b.checkIn);
    const bCheckOut = new Date(b.checkOut);
    const overlapStart = bCheckIn < startDate ? startDate : bCheckIn;
    const overlapEnd = bCheckOut > endDate ? endDate : bCheckOut;
    const diffMs = overlapEnd.getTime() - overlapStart.getTime();
    const nightsInMonth = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    totalGross = totalGross.plus(grossVal);
    totalCommission = totalCommission.plus(commVal);
    totalSoldNights += nightsInMonth;

    // Per Saluran
    const ch = b.channel;
    const chData = channelMap.get(ch) ?? {
      count: 0,
      gross: new Decimal(0),
      commission: new Decimal(0),
      net: new Decimal(0),
      hasEstimated: false,
    };
    chData.count += 1;
    chData.gross = chData.gross.plus(grossVal);
    chData.commission = chData.commission.plus(commVal);
    chData.net = chData.net.plus(netVal);
    if (b.commissionBasis === "ESTIMATED") chData.hasEstimated = true;
    channelMap.set(ch, chData);

    // Per Properti
    const pStat = propertyStats.get(b.propertyId);
    if (pStat) {
      pStat.gross = pStat.gross.plus(grossVal);
      pStat.net = pStat.net.plus(netVal);
      pStat.soldNights += nightsInMonth;
    }
  }

  // Kalkulasi Pengeluaran
  let totalExpenses = new Decimal(0);
  let draftExpenseCount = 0;
  const categoryMap = new Map<
    string,
    { name: string; amount: Decimal; count: number; hasDrafts: boolean }
  >();

  for (const e of expenses) {
    const amt = new Decimal(e.amount.toString());
    totalExpenses = totalExpenses.plus(amt);

    if (e.status === "DRAFT") {
      draftExpenseCount += 1;
    }

    const cCode = e.category.code;
    const cData = categoryMap.get(cCode) ?? {
      name: e.category.name,
      amount: new Decimal(0),
      count: 0,
      hasDrafts: false,
    };
    cData.amount = cData.amount.plus(amt);
    cData.count += 1;
    if (e.status === "DRAFT") cData.hasDrafts = true;
    categoryMap.set(cCode, cData);

    // Alokasi ke properti
    if (e.propertyId) {
      const pStat = propertyStats.get(e.propertyId);
      if (pStat) pStat.expenses = pStat.expenses.plus(amt);
    } else if (e.allocations.length > 0) {
      for (const alloc of e.allocations) {
        const pStat = propertyStats.get(alloc.propertyId);
        if (pStat) {
          pStat.expenses = pStat.expenses.plus(new Decimal(alloc.amountBase.toString()));
        }
      }
    }
  }

  // Pendapatan Lain
  let totalOtherIncome = new Decimal(0);
  for (const oi of otherIncomes) {
    totalOtherIncome = totalOtherIncome.plus(new Decimal(oi.amount.toString()));
  }

  const totalNet = totalGross.minus(totalCommission);
  const totalOperationalResult = totalNet.plus(totalOtherIncome).minus(totalExpenses);

  const effRate = totalGross.isZero()
    ? 0
    : Math.round(totalCommission.dividedBy(totalGross).toNumber() * 1000) / 10;
  const occupancyRate =
    totalAvailableNights > 0 ? Math.round((totalSoldNights / totalAvailableNights) * 1000) / 10 : 0;
  const adr = totalSoldNights > 0 ? totalGross.dividedBy(totalSoldNights).toFixed(0) : "0";
  const revpar =
    totalAvailableNights > 0 ? totalGross.dividedBy(totalAvailableNights).toFixed(0) : "0";

  // Channel Breakdown Array
  const channels: ReportChannelBreakdown[] = Array.from(channelMap.entries()).map(
    ([channel, val]) => {
      const rate = val.gross.isZero()
        ? 0
        : Math.round(val.commission.dividedBy(val.gross).toNumber() * 1000) / 10;
      return {
        channel,
        bookingCount: val.count,
        gross: val.gross.toFixed(0),
        commission: val.commission.toFixed(0),
        net: val.net.toFixed(0),
        effectiveRate: rate,
        hasEstimated: val.hasEstimated,
      };
    },
  );

  // Expense Categories Array
  const expenseCategories: ReportExpenseCategoryBreakdown[] = Array.from(categoryMap.entries()).map(
    ([code, val]) => {
      const pct = totalExpenses.isZero()
        ? 0
        : Math.round(val.amount.dividedBy(totalExpenses).toNumber() * 1000) / 10;
      return {
        categoryCode: code,
        categoryName: val.name,
        amount: val.amount.toFixed(0),
        percentageOfTotal: pct,
        entryCount: val.count,
        hasDrafts: val.hasDrafts,
      };
    },
  );

  // Property Breakdown Array
  const propertyBreakdown: ReportPropertyBreakdown[] = Array.from(propertyStats.values()).map(
    (p) => {
      const avail = propertyAvailableNights[p.id] ?? 1;
      const occ = Math.round((p.soldNights / avail) * 1000) / 10;
      const pAdr = p.soldNights > 0 ? p.gross.dividedBy(p.soldNights).toFixed(0) : "0";
      const opResult = p.net.minus(p.expenses);
      return {
        propertyId: p.id,
        propertyName: p.name,
        gross: p.gross.toFixed(0),
        net: p.net.toFixed(0),
        expenses: p.expenses.toFixed(0),
        operationalResult: opResult.toFixed(0),
        soldNights: p.soldNights,
        availableNights: avail,
        occupancyRate: occ,
        adr: pAdr,
      };
    },
  );

  // Snapshot & Variance
  const isLocked = !!periodLock;
  let snapshotData: ReportSnapshot | null = null;
  let variance: ReportVariance | null = null;

  if (periodLock && periodLock.snapshot) {
    const rawSnap = periodLock.snapshot as unknown as ReportSnapshot;
    snapshotData = rawSnap;

    const snapGross = new Decimal(rawSnap.gross || 0);
    const snapComm = new Decimal(rawSnap.commission || 0);
    const snapNet = new Decimal(rawSnap.net || 0);
    const snapExp = new Decimal(rawSnap.expenses || 0);
    const snapOp = new Decimal(rawSnap.operationalResult || 0);

    const diffGross = totalGross.minus(snapGross);
    const diffComm = totalCommission.minus(snapComm);
    const diffNet = totalNet.minus(snapNet);
    const diffExp = totalExpenses.minus(snapExp);
    const diffOp = totalOperationalResult.minus(snapOp);

    const hasVar =
      !diffGross.isZero() ||
      !diffComm.isZero() ||
      !diffNet.isZero() ||
      !diffExp.isZero() ||
      !diffOp.isZero();

    variance = {
      grossDiff: diffGross.toFixed(0),
      commissionDiff: diffComm.toFixed(0),
      netDiff: diffNet.toFixed(0),
      expensesDiff: diffExp.toFixed(0),
      operationalResultDiff: diffOp.toFixed(0),
      hasVariance: hasVar,
    };
  }

  const unmetRequirements: string[] = [];
  if (draftExpenseCount > 0) {
    unmetRequirements.push(
      `Terdapat ${draftExpenseCount} pengeluaran berstatus DRAFT yang belum diverifikasi`,
    );
  }

  const canLock = !isLocked && unmetRequirements.length === 0;

  return {
    period,
    year,
    month,
    periodLabel,
    propertyFilterName,
    kpis: {
      gross: totalGross.toFixed(0),
      commission: totalCommission.toFixed(0),
      net: totalNet.toFixed(0),
      expenses: totalExpenses.toFixed(0),
      otherIncome: totalOtherIncome.toFixed(0),
      operationalResult: totalOperationalResult.toFixed(0),
      effectiveCommissionRate: effRate,
      soldNights: totalSoldNights,
      availableNights: totalAvailableNights,
      occupancyRate,
      adr,
      revpar,
      totalBookings: bookings.length,
    },
    channels,
    expenseCategories,
    properties: propertyBreakdown,
    lock: {
      isLocked,
      lockedAt: periodLock ? periodLock.lockedAt.toISOString() : null,
      lockedBy: periodLock ? periodLock.lockedById : null,
      snapshot: snapshotData,
      variance,
      canLock,
      unmetRequirements,
    },
  };
}

export async function getPeriodLockList(input: {
  organizationId: string;
}): Promise<PeriodLockListItem[]> {
  const { organizationId } = input;

  // Generate 12 bulan terakhir
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-12

  const periods: { year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    let y = currentYear;
    let m = currentMonth - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push({ year: y, month: m });
  }

  // Ambil data period lock
  const periodLocks = await prisma.periodLock.findMany({
    where: { organizationId },
  });

  const lockMap = new Map<string, { lockedAt: Date; lockedById: string }>();
  for (const pl of periodLocks) {
    const y = pl.period.getUTCFullYear();
    const m = (pl.period.getUTCMonth() + 1).toString().padStart(2, "0");
    lockMap.set(`${y}-${m}`, { lockedAt: pl.lockedAt, lockedById: pl.lockedById });
  }

  // Ambil draft expense count per bulan
  const draftExpenses = await prisma.expense.findMany({
    where: {
      organizationId,
      status: "DRAFT",
    },
    select: { incurredOn: true },
  });

  const draftCountMap = new Map<string, number>();
  for (const d of draftExpenses) {
    const y = d.incurredOn.getUTCFullYear();
    const m = (d.incurredOn.getUTCMonth() + 1).toString().padStart(2, "0");
    const key = `${y}-${m}`;
    draftCountMap.set(key, (draftCountMap.get(key) ?? 0) + 1);
  }

  return periods.map(({ year, month }) => {
    const monthStr = month.toString().padStart(2, "0");
    const key = `${year}-${monthStr}`;
    const label = `${MONTH_NAMES_ID[month - 1]} ${year}`;
    const locked = lockMap.get(key);
    const draftCount = draftCountMap.get(key) ?? 0;

    return {
      period: key,
      periodLabel: label,
      isLocked: !!locked,
      lockedAt: locked ? locked.lockedAt.toISOString() : null,
      lockedById: locked ? locked.lockedById : null,
      draftExpenseCount: draftCount,
      canLock: !locked && draftCount === 0,
    };
  });
}
