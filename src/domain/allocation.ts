/**
 * Modul Alokasi Estate / Multi-unit Listing.
 * Sumber kebenaran: docs/05 §3 (Alokasi ke unit), §1 (konvensi pembulatan),
 * docs/DECISIONS.md OD-07 & OD-18, docs/04 model BookingUnit.
 *
 * Aturan prioritas penentuan bobot (docs/05 §3 & OD-07):
 * 1. ListingUnit.allocationWeight bila ada pada seluruh unit;
 * 2. Unit.baseRate bila ada pada seluruh unit;
 * 3. Unit.maxGuests bila ada pada seluruh unit;
 * 4. Sama rata (equal split).
 *
 * Invarian:
 * - Nilai asli tetap di Booking.grossAmount;
 * - Jumlah alokasi (Σ allocatedGross) selalu identik dengan grossAmount asal;
 * - Sisa pembulatan per-currency minor unit (IDR=0 dp, USD=2 dp) masuk ke unit terakhir;
 * - Jumlah persentase (Σ allocationPct) selalu identik dengan Decimal 1.0000 (100%).
 */

import { Decimal } from "../lib/decimal";
import { money, round, sub, type Currency, type Money } from "../lib/money";

export type AllocationTier = "EXPLICIT_WEIGHT" | "BASE_RATE" | "MAX_GUESTS" | "EQUAL_SPLIT";

export interface AllocatableUnit {
  unitId: string;
  allocationWeight?: Decimal | number | string | null;
  baseRate?: Money | Decimal | number | string | null;
  maxGuests?: number | null;
}

export interface UnitAllocation {
  unitId: string;
  allocatedGross: Money;
  allocationPct: Decimal;
  effectiveWeight: Decimal;
}

export interface BookingAllocationResult {
  allocations: readonly UnitAllocation[];
  tierUsed: AllocationTier;
  totalGross: Money;
}

/** ISO 4217 minor unit digits untuk presisi alokasi mata uang (OD-18). */
const CURRENCY_MINOR_UNITS: Partial<Record<Currency, number>> = {
  IDR: 0,
  USD: 2,
};

export function currencyPlaces(currency: Currency): number {
  return CURRENCY_MINOR_UNITS[currency] ?? 2;
}

function decimalMin(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}

function decimalMax(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}

function toPositiveDecimal(val: unknown): Decimal | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && "amount" in (val as Record<string, unknown>)) {
    const m = val as Money;
    if (m.amount.isPositive() && !m.amount.isZero()) {
      return m.amount;
    }
    return null;
  }
  try {
    const d = val instanceof Decimal ? val : new Decimal(val as string | number | Decimal);
    if (!d.isNaN() && d.isPositive() && !d.isZero() && d.isFinite()) {
      return d;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Menyelesaikan bobot (weights) dan tier yang dipakai berdasarkan prioritas:
 * 1. allocationWeight -> 2. baseRate -> 3. maxGuests -> 4. equal split
 */
export function resolveAllocationWeights(units: readonly AllocatableUnit[]): {
  tier: AllocationTier;
  weights: Decimal[];
} {
  if (units.length === 0) {
    throw new Error("resolveAllocationWeights: units must not be empty");
  }

  // Tier 1: ListingUnit.allocationWeight (harus valid & positif pada SEMUA unit)
  const explicitWeights = units.map((u) => toPositiveDecimal(u.allocationWeight));
  if (explicitWeights.every((w): w is Decimal => w !== null)) {
    return { tier: "EXPLICIT_WEIGHT", weights: explicitWeights };
  }

  // Tier 2: Unit.baseRate (harus valid & positif pada SEMUA unit)
  const baseRateWeights = units.map((u) => toPositiveDecimal(u.baseRate));
  if (baseRateWeights.every((w): w is Decimal => w !== null)) {
    return { tier: "BASE_RATE", weights: baseRateWeights };
  }

  // Tier 3: Unit.maxGuests (harus valid integer & positif pada SEMUA unit)
  const maxGuestWeights = units.map((u) => {
    if (typeof u.maxGuests === "number" && Number.isInteger(u.maxGuests) && u.maxGuests > 0) {
      return new Decimal(u.maxGuests);
    }
    return null;
  });
  if (maxGuestWeights.every((w): w is Decimal => w !== null)) {
    return { tier: "MAX_GUESTS", weights: maxGuestWeights };
  }

  // Tier 4: Equal split (sama rata)
  return {
    tier: "EQUAL_SPLIT",
    weights: units.map(() => new Decimal(1)),
  };
}

/**
 * Alokasikan gross booking ke unit-unit anggota listing (docs/05 §3).
 */
export function allocateBookingToUnits(
  gross: Money,
  units: readonly AllocatableUnit[],
): BookingAllocationResult {
  if (units.length === 0) {
    throw new Error("allocateBookingToUnits: units must not be empty");
  }
  if (gross.amount.isNegative()) {
    throw new Error("allocateBookingToUnits: gross must be non-negative");
  }

  // Pastikan unitId unik
  const seenIds = new Set<string>();
  for (const u of units) {
    if (!u.unitId || typeof u.unitId !== "string") {
      throw new Error("allocateBookingToUnits: unitId must be a non-empty string");
    }
    if (seenIds.has(u.unitId)) {
      throw new Error(`allocateBookingToUnits: duplicate unitId "${u.unitId}" found`);
    }
    seenIds.add(u.unitId);
  }

  const { tier, weights } = resolveAllocationWeights(units);
  const places = currencyPlaces(gross.currency);
  const totalWeight = weights.reduce((acc, w) => acc.plus(w), new Decimal(0));

  // Kasus 1: Unit tunggal (100% alokasi)
  if (units.length === 1) {
    const firstUnit = units[0]!;
    const firstWeight = weights[0]!;
    return {
      tierUsed: tier,
      totalGross: gross,
      allocations: [
        {
          unitId: firstUnit.unitId,
          allocatedGross: round(gross, places),
          allocationPct: new Decimal("1.0000"),
          effectiveWeight: firstWeight,
        },
      ],
    };
  }

  // Kasus 2: Multi-unit (estate)
  const count = units.length;
  const grossSlices: Money[] = [];
  const pctSlices: Decimal[] = [];
  let remainingGross = gross;
  let remainingPct = new Decimal(1);

  for (let i = 0; i < count - 1; i++) {
    const w = weights[i]!;
    // Alokasi gross per unit (half-up sesuai ISO 4217 minor units)
    const share = gross.amount
      .times(w)
      .dividedBy(totalWeight)
      .toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
    const cappedShare = decimalMax(new Decimal(0), decimalMin(remainingGross.amount, share));
    const grossSlice = money(cappedShare, gross.currency);
    grossSlices.push(grossSlice);
    remainingGross = sub(remainingGross, grossSlice);

    // Alokasi persentase (4 desimal: Decimal(7,4) pada skema Prisma)
    const pct = w.dividedBy(totalWeight).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const cappedPct = decimalMax(new Decimal(0), decimalMin(remainingPct, pct));
    pctSlices.push(cappedPct);
    remainingPct = remainingPct.minus(cappedPct);
  }

  // Sisa gross masuk ke unit terakhir (docs/05 §1 & §3: total selalu cocok)
  grossSlices.push(round(remainingGross, places));

  // Sisa persentase masuk ke unit terakhir (total persentase selalu tepat 1.0000)
  pctSlices.push(remainingPct.toDecimalPlaces(4));

  const allocations: UnitAllocation[] = units.map((u, i) => ({
    unitId: u.unitId,
    allocatedGross: grossSlices[i]!,
    allocationPct: pctSlices[i]!,
    effectiveWeight: weights[i]!,
  }));

  return {
    allocations,
    tierUsed: tier,
    totalGross: gross,
  };
}
