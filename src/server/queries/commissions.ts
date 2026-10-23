/**
 * Server queries dan mutations untuk Komisi dan Rekonsiliasi (Sprint 7 / S7-01 & S7-03).
 *
 * Mengelola aturan komisi (CommissionRule) dan alur estimasi -> aktual.
 * Sumber kebenaran: docs/05 §5, docs/07 §3.
 */
import type { ChannelCode, CollectType, CommissionBasis, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import { money } from "@/lib/money";
import { toStayDate, type StayDate } from "@/lib/dates";
import {
  findActiveCommissionRule,
  estimateCommission,
  reconcileCommission,
  validateCommissionRule,
  type CommissionRuleInput,
} from "@/domain/commission";
import { AUDIT_ACTIONS, writeAudit } from "@/ingest/pipeline/audit";

export interface CommissionRuleDto {
  id: string;
  channel: ChannelCode;
  rate: string; // e.g. "0.1500"
  ratePercentage: string; // e.g. "15.0%"
  collectType: CollectType;
  validFrom: StayDate;
  validTo: StayDate | null;
  listingId: string | null;
  listingName?: string | null;
  propertyName?: string | null;
  notes: string | null;
}

export interface CreateCommissionRuleInput {
  channel: ChannelCode;
  rate: string | number | Decimal;
  collectType?: CollectType;
  validFrom: string; // 'YYYY-MM-DD'
  validTo?: string | null;
  listingId?: string | null;
  notes?: string | null;
  organizationId?: string;
  actorId?: string | null;
}

export interface UpdateCommissionRuleInput {
  channel?: ChannelCode;
  rate?: string | number | Decimal;
  collectType?: CollectType;
  validFrom?: string;
  validTo?: string | null;
  listingId?: string | null;
  notes?: string | null;
  organizationId?: string;
  actorId?: string | null;
}

export interface CommissionReconciliationItem {
  bookingId: string;
  externalId: string;
  channel: ChannelCode;
  propertyId: string;
  propertyName: string;
  listingName: string;
  checkIn: StayDate;
  checkOut: StayDate;
  currency: string;
  grossAmount: string;
  commissionAmount: string;
  commissionBasis: CommissionBasis;
  estimatedCommission: string;
  actualCommission: string;
  variance: string; // actual - estimated
  effectiveRate: string; // actual / gross
  isMatched: boolean;
  collectType: CollectType;
  payoutDate?: StayDate | null;
  payoutReference?: string | null;
}

export interface CommissionReconciliationSummary {
  items: CommissionReconciliationItem[];
  summary: {
    totalBookings: number;
    matchedBookings: number;
    discrepancyBookings: number;
    totalGross: string;
    totalEstimatedCommission: string;
    totalActualCommission: string;
    totalVariance: string;
    currency: string;
  };
}

/**
 * Mengambil daftar aturan komisi yang terdaftar.
 */
export async function listCommissionRules(args?: {
  channel?: ChannelCode | null;
  listingId?: string | null;
}): Promise<CommissionRuleDto[]> {
  const where: Prisma.CommissionRuleWhereInput = {};
  if (args?.channel) where.channel = args.channel;
  if (args?.listingId) where.listingId = args.listingId;

  const rules = await prisma.commissionRule.findMany({
    where,
    include: {
      listing: {
        include: {
          property: true,
        },
      },
    },
    orderBy: [{ channel: "asc" }, { validFrom: "desc" }],
  });

  return rules.map((r) => {
    const rateDec = new Decimal(r.rate.toString());
    const pct = rateDec.times(100).toFixed(1) + "%";
    return {
      id: r.id,
      channel: r.channel,
      rate: rateDec.toFixed(4),
      ratePercentage: pct,
      collectType: r.collectType,
      validFrom: toStayDate(r.validFrom),
      validTo: r.validTo ? toStayDate(r.validTo) : null,
      listingId: r.listingId,
      listingName: r.listing?.name ?? null,
      propertyName: r.listing?.property.name ?? null,
      notes: r.notes,
    };
  });
}

/**
 * Mengambil satu aturan komisi berdasarkan ID.
 */
export async function getCommissionRuleById(id: string): Promise<CommissionRuleDto | null> {
  const r = await prisma.commissionRule.findUnique({
    where: { id },
    include: {
      listing: {
        include: { property: true },
      },
    },
  });
  if (!r) return null;

  const rateDec = new Decimal(r.rate.toString());
  return {
    id: r.id,
    channel: r.channel,
    rate: rateDec.toFixed(4),
    ratePercentage: rateDec.times(100).toFixed(1) + "%",
    collectType: r.collectType,
    validFrom: toStayDate(r.validFrom),
    validTo: r.validTo ? toStayDate(r.validTo) : null,
    listingId: r.listingId,
    listingName: r.listing?.name ?? null,
    propertyName: r.listing?.property.name ?? null,
    notes: r.notes,
  };
}

/**
 * Membuat aturan komisi baru (S7-01).
 */
export async function createCommissionRule(
  input: CreateCommissionRuleInput,
): Promise<CommissionRuleDto> {
  const rate = input.rate instanceof Decimal ? input.rate : new Decimal(input.rate);
  const validFrom = input.validFrom as StayDate;
  const validTo = input.validTo ? (input.validTo as StayDate) : null;
  const collectType = input.collectType ?? "UNKNOWN";

  // Validasi domain murni
  validateCommissionRule({
    channel: input.channel,
    rate,
    collectType,
    validFrom,
    validTo,
    listingId: input.listingId,
  });

  const created = await prisma.commissionRule.create({
    data: {
      channel: input.channel,
      rate,
      collectType,
      validFrom: new Date(`${validFrom}T00:00:00.000Z`),
      validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`) : null,
      listingId: input.listingId ?? null,
      notes: input.notes ?? null,
    },
    include: {
      listing: {
        include: { property: true },
      },
    },
  });

  if (input.organizationId) {
    await writeAudit(prisma, {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: AUDIT_ACTIONS.commissionRuleCreated,
      entityType: "CommissionRule",
      entityId: created.id,
      after: {
        channel: created.channel,
        rate: rate.toString(),
        collectType: created.collectType,
        validFrom,
        validTo,
      },
    });
  }

  return {
    id: created.id,
    channel: created.channel,
    rate: rate.toFixed(4),
    ratePercentage: rate.times(100).toFixed(1) + "%",
    collectType: created.collectType,
    validFrom,
    validTo,
    listingId: created.listingId,
    listingName: created.listing?.name ?? null,
    propertyName: created.listing?.property.name ?? null,
    notes: created.notes,
  };
}

/**
 * Memperbarui aturan komisi.
 */
export async function updateCommissionRule(
  id: string,
  input: UpdateCommissionRuleInput,
): Promise<CommissionRuleDto> {
  const existing = await prisma.commissionRule.findUniqueOrThrow({ where: { id } });

  const rate = input.rate !== undefined ? new Decimal(input.rate) : existing.rate;
  const validFrom =
    input.validFrom !== undefined ? (input.validFrom as StayDate) : toStayDate(existing.validFrom);
  const validTo =
    input.validTo !== undefined
      ? input.validTo
        ? (input.validTo as StayDate)
        : null
      : existing.validTo
        ? toStayDate(existing.validTo)
        : null;
  const collectType = input.collectType ?? existing.collectType;
  const channel = input.channel ?? existing.channel;
  const listingId = input.listingId !== undefined ? input.listingId : existing.listingId;

  validateCommissionRule({
    channel,
    rate,
    collectType,
    validFrom,
    validTo,
    listingId,
  });

  const updated = await prisma.commissionRule.update({
    where: { id },
    data: {
      channel,
      rate,
      collectType,
      validFrom: new Date(`${validFrom}T00:00:00.000Z`),
      validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`) : null,
      listingId,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    },
    include: {
      listing: {
        include: { property: true },
      },
    },
  });

  if (input.organizationId) {
    await writeAudit(prisma, {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: AUDIT_ACTIONS.commissionRuleUpdated,
      entityType: "CommissionRule",
      entityId: updated.id,
      before: {
        rate: existing.rate.toString(),
        validFrom: toStayDate(existing.validFrom),
        validTo: existing.validTo ? toStayDate(existing.validTo) : null,
      },
      after: {
        rate: rate.toString(),
        validFrom,
        validTo,
      },
    });
  }

  return {
    id: updated.id,
    channel: updated.channel,
    rate: rate.toFixed(4),
    ratePercentage: rate.times(100).toFixed(1) + "%",
    collectType: updated.collectType,
    validFrom,
    validTo,
    listingId: updated.listingId,
    listingName: updated.listing?.name ?? null,
    propertyName: updated.listing?.property.name ?? null,
    notes: updated.notes,
  };
}

/**
 * Menghapus aturan komisi.
 */
export async function deleteCommissionRule(
  id: string,
  organizationId?: string,
  actorId?: string | null,
): Promise<{ success: boolean }> {
  const existing = await prisma.commissionRule.findUniqueOrThrow({ where: { id } });

  await prisma.commissionRule.delete({ where: { id } });

  if (organizationId) {
    await writeAudit(prisma, {
      organizationId,
      actorId: actorId ?? null,
      action: AUDIT_ACTIONS.commissionRuleDeleted,
      entityType: "CommissionRule",
      entityId: id,
      before: {
        channel: existing.channel,
        rate: existing.rate.toString(),
        validFrom: toStayDate(existing.validFrom),
      },
    });
  }

  return { success: true };
}

/**
 * Menghitung dan menyimpan estimasi komisi untuk satu booking (S7-01).
 * Menggunakan aturan komisi aktif pada tanggal check-in booking.
 */
export async function estimateCommissionForBooking(bookingId: string): Promise<{
  bookingId: string;
  commissionAmount: string;
  commissionRate: string;
  commissionBasis: CommissionBasis;
  collectType: CollectType;
}> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  const stayDate = toStayDate(booking.checkIn);
  const rules = await prisma.commissionRule.findMany({
    where: {
      channel: booking.channel,
    },
  });

  const ruleInputs: CommissionRuleInput[] = rules.map((r) => ({
    id: r.id,
    channel: r.channel,
    rate: new Decimal(r.rate.toString()),
    collectType: r.collectType,
    validFrom: toStayDate(r.validFrom),
    validTo: r.validTo ? toStayDate(r.validTo) : null,
    listingId: r.listingId ?? undefined,
  }));

  const activeRule = findActiveCommissionRule(ruleInputs, {
    channel: booking.channel,
    date: stayDate,
    listingId: booking.listingId,
  });

  const grossMoney = money(booking.grossAmount.toString(), booking.currency as "IDR" | "USD");
  const rateToUse = activeRule ? activeRule.rate : new Decimal("0.15"); // default 15% jika belum ada rule
  let collectTypeToUse = activeRule ? activeRule.collectType : booking.collectType;

  // Jika rule aktif tidak spesifik collectType, pertahankan booking.collectType
  if (collectTypeToUse === "UNKNOWN" && booking.collectType !== "UNKNOWN") {
    collectTypeToUse = booking.collectType;
  }

  const estimate = estimateCommission(grossMoney, rateToUse, collectTypeToUse);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      commissionAmount: estimate.commissionAmount.amount,
      commissionRate: estimate.rate,
      commissionBasis: "ESTIMATED",
      collectType: estimate.collectType,
    },
  });

  return {
    bookingId,
    commissionAmount: estimate.commissionAmount.amount.toString(),
    commissionRate: estimate.rate.toString(),
    commissionBasis: "ESTIMATED",
    collectType: estimate.collectType,
  };
}

/**
 * Mengambil data rekonsiliasi komisi antara estimasi dan aktual (S7-03).
 */
export async function getCommissionReconciliation(args: {
  organizationId: string;
  channel?: ChannelCode | null;
  propertyId?: string | null;
  from?: string | null;
  to?: string | null;
  tolerance?: number | string;
}): Promise<CommissionReconciliationSummary> {
  const where: Prisma.BookingWhereInput = {
    organizationId: args.organizationId,
    status: { in: ["CONFIRMED", "CANCELLED", "NO_SHOW"] },
  };

  if (args.channel) where.channel = args.channel;
  if (args.propertyId) where.propertyId = args.propertyId;
  if (args.from || args.to) {
    where.checkIn = {};
    if (args.from) where.checkIn.gte = new Date(`${args.from}T00:00:00.000Z`);
    if (args.to) where.checkIn.lte = new Date(`${args.to}T00:00:00.000Z`);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      property: true,
      listing: true,
      payouts: {
        include: {
          payout: true,
        },
      },
    },
    orderBy: { checkIn: "desc" },
  });

  // Ambil semua commission rules untuk fallback komisi estimasi
  const rules = await prisma.commissionRule.findMany();
  const ruleInputs: CommissionRuleInput[] = rules.map((r) => ({
    id: r.id,
    channel: r.channel,
    rate: new Decimal(r.rate.toString()),
    collectType: r.collectType,
    validFrom: toStayDate(r.validFrom),
    validTo: r.validTo ? toStayDate(r.validTo) : null,
    listingId: r.listingId ?? undefined,
  }));

  const items: CommissionReconciliationItem[] = [];
  let totalGross = new Decimal(0);
  let totalEstimated = new Decimal(0);
  let totalActual = new Decimal(0);
  let totalVariance = new Decimal(0);
  let matchedCount = 0;
  let discrepancyCount = 0;
  const currency = bookings[0]?.currency ?? "IDR";

  for (const b of bookings) {
    const gross = money(b.grossAmount.toString(), b.currency as "IDR" | "USD");
    const stayDate = toStayDate(b.checkIn);

    // Cari rule untuk estimasi
    const activeRule = findActiveCommissionRule(ruleInputs, {
      channel: b.channel,
      date: stayDate,
      listingId: b.listingId,
    });
    const fallbackRate = activeRule ? activeRule.rate : new Decimal("0.15");

    let estimatedCommissionMoney = money(0, gross.currency);
    let actualCommissionMoney = money(0, gross.currency);

    if (b.commissionBasis === "ACTUAL" && b.commissionAmount !== null) {
      actualCommissionMoney = money(b.commissionAmount.toString(), gross.currency);
      // Hitung estimasi rule sebagai perbandingan
      const est = estimateCommission(gross, fallbackRate);
      estimatedCommissionMoney = est.commissionAmount;
    } else if (b.commissionAmount !== null) {
      estimatedCommissionMoney = money(b.commissionAmount.toString(), gross.currency);
      actualCommissionMoney = estimatedCommissionMoney; // Belum ada aktual
    } else {
      const est = estimateCommission(gross, fallbackRate);
      estimatedCommissionMoney = est.commissionAmount;
      actualCommissionMoney = estimatedCommissionMoney;
    }

    const recon = reconcileCommission({
      bookingId: b.id,
      channel: b.channel,
      externalId: b.externalId,
      grossAmount: gross,
      estimatedCommission: estimatedCommissionMoney,
      actualCommission: actualCommissionMoney,
      toleranceThreshold: args.tolerance ?? 0,
    });

    if (recon.isMatched) {
      matchedCount++;
    } else {
      discrepancyCount++;
    }

    totalGross = totalGross.plus(gross.amount);
    totalEstimated = totalEstimated.plus(estimatedCommissionMoney.amount);
    totalActual = totalActual.plus(actualCommissionMoney.amount);
    totalVariance = totalVariance.plus(recon.variance.amount);

    const latestPayout = b.payouts[0]?.payout;

    items.push({
      bookingId: b.id,
      externalId: b.externalId,
      channel: b.channel,
      propertyId: b.propertyId,
      propertyName: b.property.name,
      listingName: b.listing.name,
      checkIn: stayDate,
      checkOut: toStayDate(b.checkOut),
      currency: b.currency,
      grossAmount: gross.amount.toString(),
      commissionAmount: (b.commissionAmount ?? estimatedCommissionMoney.amount).toString(),
      commissionBasis: b.commissionBasis ?? "ESTIMATED",
      estimatedCommission: estimatedCommissionMoney.amount.toString(),
      actualCommission: actualCommissionMoney.amount.toString(),
      variance: recon.variance.amount.toString(),
      effectiveRate: recon.effectiveRate.times(100).toFixed(2) + "%",
      isMatched: recon.isMatched,
      collectType: b.collectType,
      payoutDate: latestPayout ? toStayDate(latestPayout.payoutDate) : null,
      payoutReference: latestPayout?.reference ?? null,
    });
  }

  return {
    items,
    summary: {
      totalBookings: bookings.length,
      matchedBookings: matchedCount,
      discrepancyBookings: discrepancyCount,
      totalGross: totalGross.toString(),
      totalEstimatedCommission: totalEstimated.toString(),
      totalActualCommission: totalActual.toString(),
      totalVariance: totalVariance.toString(),
      currency,
    },
  };
}
