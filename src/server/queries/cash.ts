/**
 * Server queries untuk Arus Kas dan Komisi Terutang (Sprint 7 / S7-04).
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.5 (halaman Kas),
 * docs/05 §5 (alur kas CHANNEL_COLLECT vs HOTEL_COLLECT).
 *
 * Prinsip:
 * - Kas masuk: berdasarkan tanggal payout per OTA (CHANNEL_COLLECT) + penerimaan langsung tamu (HOTEL_COLLECT).
 * - Kas keluar: berdasarkan tanggal bayar (paidOn) pengeluaran terverifikasi.
 * - Komisi terutang: saldo komisi payable ke OTA untuk booking HOTEL_COLLECT.
 * - Pendapatan belum cair: booking channel-collect yang sudah selesai menginap tapi payout belum masuk.
 */
import type { ChannelCode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import { money, sub, zero } from "@/lib/money";
import { toStayDate, type StayDate } from "@/lib/dates";
import { computeOutstandingHotelCommission } from "@/domain/commission";

export interface CashFlowFilters {
  organizationId: string;
  propertyId?: string | null;
  from?: string | null; // StayDate 'YYYY-MM-DD'
  to?: string | null;
}

export interface OutstandingCommissionItem {
  channel: ChannelCode;
  channelName: string;
  currency: string;
  totalGrossCollected: string;
  totalCommissionPayable: string;
  bookingCount: number;
}

export interface PayoutHistoryItem {
  id: string;
  channel: ChannelCode;
  channelName: string;
  payoutDate: StayDate;
  amount: string;
  currency: string;
  reference: string;
  linkedBookingsCount: number;
}

export interface PendingPayoutItem {
  bookingId: string;
  externalId: string;
  channel: ChannelCode;
  channelName: string;
  propertyName: string;
  checkOut: StayDate;
  grossAmount: string;
  estimatedNet: string;
  currency: string;
}

export interface CashFlowSummaryDto {
  metrics: {
    totalCashIn: string;
    payoutsReceived: string;
    hotelCollectReceived: string;
    totalCashOut: string;
    netCashFlow: string;
    totalOutstandingCommission: string;
    totalPendingPayout: string;
    currency: string;
  };
  outstandingCommissions: OutstandingCommissionItem[];
  recentPayouts: PayoutHistoryItem[];
  pendingPayouts: PendingPayoutItem[];
}

const CHANNEL_DISPLAY_NAMES: Record<ChannelCode, string> = {
  AIRBNB: "Airbnb",
  TIKET_COM: "Tiket.com",
  TRAVELOKA: "Traveloka",
  EXPEDIA: "Expedia",
  AGODA: "Agoda",
  BOOKING_COM: "Booking.com",
  DIRECT: "Direct / Langsung",
  MANUAL: "Manual",
};

/**
 * Menghitung ringkasan arus kas, komisi terutang, dan riwayat payout.
 */
export async function getCashFlowSummary(filters: CashFlowFilters): Promise<CashFlowSummaryDto> {
  const { organizationId, propertyId, from, to } = filters;
  const currency = "IDR";

  // 1. Kas Masuk dari Payout OTA (CHANNEL_COLLECT)
  const payoutWhere: Prisma.PayoutWhereInput = {
    organizationId,
  };
  if (from || to) {
    payoutWhere.payoutDate = {};
    if (from) payoutWhere.payoutDate.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) payoutWhere.payoutDate.lte = new Date(`${to}T00:00:00.000Z`);
  }

  const payouts = await prisma.payout.findMany({
    where: payoutWhere,
    include: {
      bookings: true,
    },
    orderBy: { payoutDate: "desc" },
  });

  let totalPayoutAmount = new Decimal(0);
  const recentPayouts: PayoutHistoryItem[] = [];

  for (const p of payouts) {
    const fx = p.currency === "USD" ? new Decimal(16000) : new Decimal(1);
    totalPayoutAmount = totalPayoutAmount.plus(p.amount.times(fx));
    recentPayouts.push({
      id: p.id,
      channel: p.channel,
      channelName: CHANNEL_DISPLAY_NAMES[p.channel] ?? p.channel,
      payoutDate: toStayDate(p.payoutDate),
      amount: p.amount.toString(),
      currency: p.currency,
      reference: p.reference ?? "-",
      linkedBookingsCount: p.bookings.length,
    });
  }

  // 2. Kas Masuk dari Hotel Collect (Tamu bayar langsung pada checkIn)
  const hotelCollectWhere: Prisma.BookingWhereInput = {
    organizationId,
    collectType: "HOTEL_COLLECT",
    status: { in: ["CONFIRMED", "NO_SHOW"] },
  };
  if (propertyId) hotelCollectWhere.propertyId = propertyId;
  if (from || to) {
    hotelCollectWhere.checkIn = {};
    if (from) hotelCollectWhere.checkIn.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) hotelCollectWhere.checkIn.lte = new Date(`${to}T00:00:00.000Z`);
  }

  const hotelCollectBookings = await prisma.booking.findMany({
    where: hotelCollectWhere,
  });

  let totalHotelCollectCash = new Decimal(0);
  for (const b of hotelCollectBookings) {
    const fx =
      b.currency === "USD"
        ? b.fxRateToBase
          ? new Decimal(b.fxRateToBase.toString())
          : new Decimal(16000)
        : new Decimal(1);
    totalHotelCollectCash = totalHotelCollectCash.plus(b.grossAmount.times(fx));
  }

  const totalCashIn = totalPayoutAmount.plus(totalHotelCollectCash);

  // 3. Kas Keluar (Pengeluaran yang sudah dibayar: paidOn != null)
  const expenseWhere: Prisma.ExpenseWhereInput = {
    organizationId,
    status: "VERIFIED",
    paidOn: { not: null },
  };
  if (propertyId) expenseWhere.propertyId = propertyId;
  if (from || to) {
    expenseWhere.paidOn = { not: null };
    if (from) expenseWhere.paidOn.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) expenseWhere.paidOn.lte = new Date(`${to}T00:00:00.000Z`);
  }

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
  });

  let totalCashOut = new Decimal(0);
  for (const e of expenses) {
    totalCashOut = totalCashOut.plus(e.amount);
  }

  // 4. Saldo Komisi Terutang (Hotel Collect)
  const allHotelCollect = await prisma.booking.findMany({
    where: {
      organizationId,
      collectType: "HOTEL_COLLECT",
      status: { in: ["CONFIRMED", "NO_SHOW"] },
    },
  });

  const hotelCollectItems = allHotelCollect.map((b) => {
    const fx =
      b.currency === "USD"
        ? b.fxRateToBase
          ? new Decimal(b.fxRateToBase.toString())
          : new Decimal(16000)
        : new Decimal(1);
    return {
      channel: b.channel,
      grossAmount: money(b.grossAmount.times(fx).toString(), "IDR"),
      commissionAmount: money((b.commissionAmount ?? new Decimal(0)).times(fx).toString(), "IDR"),
      collectType: b.collectType,
    };
  });

  const outstandingMap = computeOutstandingHotelCommission(hotelCollectItems);
  const outstandingCommissions: OutstandingCommissionItem[] = [];
  let totalOutstandingCommissionDec = new Decimal(0);

  for (const [ch, summary] of outstandingMap.entries()) {
    totalOutstandingCommissionDec = totalOutstandingCommissionDec.plus(
      summary.totalCommissionPayable.amount,
    );
    outstandingCommissions.push({
      channel: ch,
      channelName: CHANNEL_DISPLAY_NAMES[ch] ?? ch,
      currency: summary.currency,
      totalGrossCollected: summary.totalGrossCollected.amount.toString(),
      totalCommissionPayable: summary.totalCommissionPayable.amount.toString(),
      bookingCount: summary.bookingCount,
    });
  }

  // 5. Pendapatan sudah terjadi tapi belum cair (Pending Payouts)
  // Booking Channel Collect yang sudah checkout (tamu selesai menginap) tapi belum ada PayoutBooking
  const today = new Date();
  const pendingBookings = await prisma.booking.findMany({
    where: {
      organizationId,
      collectType: "CHANNEL_COLLECT",
      status: "CONFIRMED",
      checkOut: { lte: today },
      payouts: { none: {} },
    },
    include: {
      property: true,
    },
    take: 50,
    orderBy: { checkOut: "desc" },
  });

  let totalPendingPayoutDec = new Decimal(0);
  const pendingPayouts: PendingPayoutItem[] = [];

  for (const pb of pendingBookings) {
    const fx =
      pb.currency === "USD"
        ? pb.fxRateToBase
          ? new Decimal(pb.fxRateToBase.toString())
          : new Decimal(16000)
        : new Decimal(1);
    const gross = money(pb.grossAmount.toString(), pb.currency as "IDR" | "USD");
    const comm = pb.commissionAmount
      ? money(pb.commissionAmount.toString(), pb.currency as "IDR" | "USD")
      : zero(gross.currency);
    const estimatedNet = sub(gross, comm).amount;

    totalPendingPayoutDec = totalPendingPayoutDec.plus(estimatedNet.times(fx));
    pendingPayouts.push({
      bookingId: pb.id,
      externalId: pb.externalId,
      channel: pb.channel,
      channelName: CHANNEL_DISPLAY_NAMES[pb.channel] ?? pb.channel,
      propertyName: pb.property.name,
      checkOut: toStayDate(pb.checkOut),
      grossAmount: pb.grossAmount.toString(),
      estimatedNet: estimatedNet.toString(),
      currency: pb.currency,
    });
  }

  const netCashFlow = totalCashIn.minus(totalCashOut);

  return {
    metrics: {
      totalCashIn: totalCashIn.toString(),
      payoutsReceived: totalPayoutAmount.toString(),
      hotelCollectReceived: totalHotelCollectCash.toString(),
      totalCashOut: totalCashOut.toString(),
      netCashFlow: netCashFlow.toString(),
      totalOutstandingCommission: totalOutstandingCommissionDec.toString(),
      totalPendingPayout: totalPendingPayoutDec.toString(),
      currency,
    },
    outstandingCommissions,
    recentPayouts,
    pendingPayouts,
  };
}
