/**
 * Domain murni untuk aturan komisi, estimasi, dan rekonsiliasi keuangan OTA.
 * Sumber kebenaran: docs/05 §5 (Komisi, gross, dan net), ADR-004, OD-18.
 *
 * Murni tanpa I/O, bekerja dengan Money dan Decimal.
 */
import { type Money, type MoneyInput, round, sub, mul, zero, type Currency } from "../lib/money";
import { Decimal } from "../lib/decimal";
import type { StayDate } from "../lib/dates";
import type { ChannelCode, CollectType } from "../adapters/types";

export type CommissionBasis = "ESTIMATED" | "ACTUAL" | "MANUAL";

export interface CommissionRuleInput {
  id?: string;
  listingId?: string | null;
  channel: ChannelCode;
  rate: Decimal | number | string; // 0.1500 = 15%
  collectType: CollectType;
  validFrom: StayDate;
  validTo?: StayDate | null;
  notes?: string | null;
}

export interface CommissionEstimateResult {
  grossAmount: Money;
  rate: Decimal;
  commissionAmount: Money;
  netAmount: Money;
  commissionBasis: CommissionBasis;
  collectType: CollectType;
}

export interface CommissionReconciliationResult {
  bookingId: string;
  channel: ChannelCode;
  externalId: string;
  grossAmount: Money;
  estimatedCommission: Money;
  actualCommission: Money;
  variance: Money; // actual - estimated (positif = komisi riil lebih tinggi dari estimasi)
  effectiveRate: Decimal; // actualCommission / grossAmount
  isMatched: boolean;
  status: "MATCHED" | "DISCREPANCY";
}

export interface HotelCollectCommissionSummary {
  channel: ChannelCode;
  currency: Currency;
  totalGrossCollected: Money;
  totalCommissionPayable: Money;
  bookingCount: number;
}

/**
 * Validasi keabsahan parameter CommissionRule.
 */
export function validateCommissionRule(rule: CommissionRuleInput): void {
  const rate = rule.rate instanceof Decimal ? rule.rate : new Decimal(rule.rate);
  if (rate.isNegative() || rate.greaterThan(1)) {
    throw new Error(`Rate komisi harus di antara 0.0000 dan 1.0000, didapat: ${rate.toString()}`);
  }
  if (rule.validTo && rule.validTo < rule.validFrom) {
    throw new Error(
      `validTo (${rule.validTo}) tidak boleh mendahului validFrom (${rule.validFrom})`,
    );
  }
}

/**
 * Mencari CommissionRule yang paling spesifik dan aktif pada tanggal acuan.
 * Prioritas: Listing-specific rule > Channel-wide rule.
 */
export function findActiveCommissionRule(
  rules: readonly CommissionRuleInput[],
  query: {
    channel: ChannelCode;
    listingId?: string | null;
    date: StayDate;
  },
): CommissionRuleInput | null {
  const matches = rules.filter((r) => {
    if (r.channel !== query.channel) return false;
    if (query.date < r.validFrom) return false;
    if (r.validTo && query.date > r.validTo) return false;

    // Jika rule spesifik listing, wajib cocok dengan query.listingId
    if (r.listingId && query.listingId && r.listingId !== query.listingId) {
      return false;
    }
    // Jika rule spesifik listing tapi query tidak punya listingId, abaikan
    if (r.listingId && !query.listingId) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) return null;

  // Urutkan: listing-specific duluan, lalu validFrom terbaru
  matches.sort((a, b) => {
    if (a.listingId && !b.listingId) return -1;
    if (!a.listingId && b.listingId) return 1;
    return b.validFrom.localeCompare(a.validFrom);
  });

  return matches[0]!;
}

/**
 * Menghitung estimasi komisi dan pendapatan bersih berdampingan (ADR-004).
 */
export function estimateCommission(
  grossAmount: Money,
  ruleOrRate: CommissionRuleInput | Decimal | number | string,
  collectTypeOverride?: CollectType,
): CommissionEstimateResult {
  let rate: Decimal;
  let collectType: CollectType = collectTypeOverride ?? "CHANNEL_COLLECT";

  if (typeof ruleOrRate === "object" && "channel" in ruleOrRate) {
    validateCommissionRule(ruleOrRate);
    rate = ruleOrRate.rate instanceof Decimal ? ruleOrRate.rate : new Decimal(ruleOrRate.rate);
    if (!collectTypeOverride) collectType = ruleOrRate.collectType;
  } else {
    rate = ruleOrRate instanceof Decimal ? ruleOrRate : new Decimal(ruleOrRate);
    if (rate.isNegative() || rate.greaterThan(1)) {
      throw new Error(`Rate komisi harus di antara 0 dan 1, didapat: ${rate.toString()}`);
    }
  }

  // Hitung komisi dengan pembulatan minor unit (IDR = 0 desimal, USD = 2 desimal, OD-18)
  const places = grossAmount.currency === "IDR" ? 0 : 2;
  const rawCommission = mul(grossAmount, rate);
  const commissionAmount = round(rawCommission, places);
  const netAmount = sub(grossAmount, commissionAmount);

  return {
    grossAmount,
    rate,
    commissionAmount,
    netAmount,
    commissionBasis: "ESTIMATED",
    collectType,
  };
}

/**
 * Rekonsiliasi antara komisi estimasi dan komisi aktual dari payout/laporan OTA (S7-03).
 */
export function reconcileCommission(args: {
  bookingId: string;
  channel: ChannelCode;
  externalId: string;
  grossAmount: Money;
  estimatedCommission: Money;
  actualCommission: Money;
  toleranceThreshold?: MoneyInput;
}): CommissionReconciliationResult {
  const { bookingId, channel, externalId, grossAmount, estimatedCommission, actualCommission } =
    args;

  // Variance = Actual - Estimated
  const variance = sub(actualCommission, estimatedCommission);

  // Rate efektif = Actual Commission / Gross Amount
  const effectiveRate = grossAmount.amount.isZero()
    ? new Decimal(0)
    : actualCommission.amount.dividedBy(grossAmount.amount);

  const tolerance = new Decimal(args.toleranceThreshold ?? 0);
  const isMatched = variance.amount.abs().lessThanOrEqualTo(tolerance);

  return {
    bookingId,
    channel,
    externalId,
    grossAmount,
    estimatedCommission,
    actualCommission,
    variance,
    effectiveRate,
    isMatched,
    status: isMatched ? "MATCHED" : "DISCREPANCY",
  };
}

/**
 * Menghitung saldo komisi terutang (Hotel Collect) per OTA (S7-04 / docs/05 §5).
 */
export function computeOutstandingHotelCommission(
  bookings: ReadonlyArray<{
    channel: ChannelCode;
    grossAmount: Money;
    commissionAmount: Money;
    collectType: CollectType;
    isPaidToOta?: boolean;
  }>,
): Map<ChannelCode, HotelCollectCommissionSummary> {
  const summaries = new Map<ChannelCode, HotelCollectCommissionSummary>();

  for (const b of bookings) {
    if (b.collectType !== "HOTEL_COLLECT" || b.isPaidToOta) {
      continue;
    }

    const cur = summaries.get(b.channel) ?? {
      channel: b.channel,
      currency: b.grossAmount.currency,
      totalGrossCollected: zero(b.grossAmount.currency),
      totalCommissionPayable: zero(b.commissionAmount.currency),
      bookingCount: 0,
    };

    cur.totalGrossCollected = {
      amount: cur.totalGrossCollected.amount.plus(b.grossAmount.amount),
      currency: cur.currency,
    };
    cur.totalCommissionPayable = {
      amount: cur.totalCommissionPayable.amount.plus(b.commissionAmount.amount),
      currency: cur.currency,
    };
    cur.bookingCount += 1;

    summaries.set(b.channel, cur);
  }

  return summaries;
}
