/**
 * Modul KPI: rumus murni untuk monitoring booking dan keuangan.
 * Sumber kebenaran: docs/05 §2 (KPI), §3 (alokasi estate), §4 (status booking).
 * Tidak bergantung Prisma; menerima plain object sehingga mudah dites.
 *
 * Konvensi penting:
 * - Semua `Money` pada `KpiBooking` harus sudah dalam `baseCurrency` (default IDR).
 *   Konversi mata uang asli -> base adalah tanggung jawab pemanggil.
 * - `unitIds` untuk booking yang memetakan ke banyak unit (estate = semua unit anggota).
 *   Sold nights untuk satu malam = Σ unitId yang isSellable(malam itu).
 * - Periode [start, end) half-open inklusif-eksklusif, end > start.
 */
import { add, div, mul, round, sub, sum, zero, type Currency, type Money } from "../lib/money";
import {
  daysBetween,
  eachDayInRange,
  isStayDate,
  nightsInPeriod,
  type StayDate,
} from "../lib/dates";

export * from "./allocation";

export type KpiBookingStatus = "CONFIRMED" | "PENDING" | "CANCELLED" | "NO_SHOW";

export interface KpiBooking {
  id: string;
  propertyId: string;
  unitIds: readonly string[];
  checkIn: StayDate;
  checkOut: StayDate;
  status: KpiBookingStatus;
  bookedAt: Date | null;
  grossAmount: Money;
  cancellationFee?: Money;
}

export interface KpiUnit {
  id: string;
  propertyId: string;
  isSellable: (date: StayDate) => boolean;
}

export interface KpiProperty {
  id: string;
  units: readonly KpiUnit[];
}

export interface KpiInput {
  properties: readonly KpiProperty[];
  bookings: readonly KpiBooking[];
  baseCurrency?: Currency;
}

export interface Period {
  start: StayDate;
  end: StayDate;
}

export interface StayKpis {
  soldNights: number;
  availableNights: number;
  occupancy: number;
  grossRevenue: Money;
  cancellationFeeRevenue: Money;
  adr: Money | null;
  revpar: Money | null;
}

export interface BookedKpis {
  bookedCount: number;
  cancelledCount: number;
  cancellationRate: number | null;
  leadTimeDays: number | null;
}

export interface PaceKpis {
  upcomingBookings: number;
  priorYearBookings: number;
  bookingPaceRatio: number | null;
  upcomingRevenue: Money;
  priorYearRevenue: Money;
  revenuePaceRatio: number | null;
}

/** Alokasi gross ke N malam; half-up 2 dp; slot terakhir menyerap sisa. */
export function nightlyAllocation(gross: Money, nights: number): Money[] {
  if (!Number.isInteger(nights) || nights <= 0) {
    throw new Error("nightlyAllocation: nights must be a positive integer, got " + nights);
  }
  if (gross.amount.isNegative()) {
    throw new Error("nightlyAllocation: gross must be non-negative");
  }
  const places = currencyPlaces(gross.currency);
  if (nights === 1) return [round(gross, places)];
  const baseSlice = round(div(gross, nights), places, "half-up");
  const slices: Money[] = [];
  for (let i = 0; i < nights - 1; i++) slices.push(baseSlice);
  const distributed = sum(slices, gross.currency);
  const remainder = sub(gross, distributed);
  slices.push(round(remainder, places));
  return slices;
}

/** ISO 4217 minor unit digits untuk currency yang dipakai saat ini. */
const CURRENCY_MINOR_UNITS: Partial<Record<Currency, number>> = { IDR: 0, USD: 2 };
function currencyPlaces(currency: Currency): number {
  return CURRENCY_MINOR_UNITS[currency] ?? 2;
}

function validatePeriod(p: Period, label: string): void {
  if (!isStayDate(p.start)) throw new Error(label + ": start invalid (" + p.start + ")");
  if (!isStayDate(p.end)) throw new Error(label + ": end invalid (" + p.end + ")");
  if (p.start >= p.end) throw new Error(label + ": end must be > start");
}

function validateBooking(b: KpiBooking, baseCurrency: Currency): void {
  if (!isStayDate(b.checkIn)) throw new Error("Booking " + b.id + ": checkIn invalid");
  if (!isStayDate(b.checkOut)) throw new Error("Booking " + b.id + ": checkOut invalid");
  if (b.checkIn >= b.checkOut) {
    throw new Error("Booking " + b.id + ": checkOut must be > checkIn");
  }
  if (b.grossAmount.currency !== baseCurrency) {
    throw new Error(
      "Booking " +
        b.id +
        ": grossAmount currency " +
        b.grossAmount.currency +
        " != base " +
        baseCurrency +
        ". Convert before calling.",
    );
  }
  if (b.status === "CONFIRMED" && b.unitIds.length === 0) {
    throw new Error("Booking " + b.id + ": CONFIRMED must have at least one unitId");
  }
  if (b.cancellationFee && b.cancellationFee.currency !== baseCurrency) {
    throw new Error("Booking " + b.id + ": cancellationFee currency mismatch");
  }
}

function findUnit(input: KpiInput, unitId: string): KpiUnit | null {
  for (const p of input.properties) {
    for (const u of p.units) {
      if (u.id === unitId) return u;
    }
  }
  return null;
}

function stayDateToUtcMs(value: StayDate): number {
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  return Date.UTC(y, m - 1, d);
}

/** Hitung KPI berbasis tanggal menginap (docs/05 §2 + §4). */
export function computeStayKpis(input: KpiInput, period: Period): StayKpis {
  const baseCurrency = input.baseCurrency ?? "IDR";
  validatePeriod(period, "period");
  for (const b of input.bookings) validateBooking(b, baseCurrency);

  const days = eachDayInRange(period);
  let availableNights = 0;
  for (const d of days) {
    for (const p of input.properties) {
      for (const u of p.units) {
        if (u.isSellable(d)) availableNights++;
      }
    }
  }

  let soldNights = 0;
  let grossAcc = zero(baseCurrency);
  for (const b of input.bookings) {
    if (b.status !== "CONFIRMED") continue;
    const totalNights = daysBetween(b.checkIn, b.checkOut);
    const allocation = nightlyAllocation(b.grossAmount, totalNights);
    const stayNights = nightsInPeriod(b.checkIn, b.checkOut, period.start, period.end);
    for (const night of stayNights) {
      const idx = daysBetween(b.checkIn, night);
      const slice = allocation[idx];
      if (!slice) continue;
      for (const uid of b.unitIds) {
        const u = findUnit(input, uid);
        if (u && u.isSellable(night)) soldNights++;
      }
      grossAcc = add(grossAcc, slice);
    }
  }

  let feeAcc = zero(baseCurrency);
  for (const b of input.bookings) {
    if (b.status !== "CANCELLED" && b.status !== "NO_SHOW") continue;
    if (!b.cancellationFee) continue;
    if (b.checkIn >= period.start && b.checkIn < period.end) {
      feeAcc = add(feeAcc, b.cancellationFee);
    }
  }

  const occupancy = availableNights === 0 ? 0 : soldNights / availableNights;
  const adr = soldNights === 0 ? null : div(grossAcc, soldNights);
  const revpar = availableNights === 0 ? null : div(grossAcc, availableNights);

  return {
    soldNights,
    availableNights,
    occupancy,
    grossRevenue: grossAcc,
    cancellationFeeRevenue: feeAcc,
    adr,
    revpar,
  };
}

/** KPI berbasis waktu pembuatan booking: lead time + cancellation rate. */
export function computeBookedKpis(input: KpiInput, bookedPeriod: Period): BookedKpis {
  validatePeriod(bookedPeriod, "bookedPeriod");
  const startMs = stayDateToUtcMs(bookedPeriod.start);
  const endMs = stayDateToUtcMs(bookedPeriod.end);

  let bookedCount = 0;
  let cancelledCount = 0;
  let leadSum = 0;
  let leadN = 0;
  for (const b of input.bookings) {
    if (!b.bookedAt) continue;
    const t = b.bookedAt.getTime();
    if (t < startMs || t >= endMs) continue;
    bookedCount++;
    if (b.status === "CANCELLED" || b.status === "NO_SHOW") cancelledCount++;
    const checkInMs = stayDateToUtcMs(b.checkIn);
    const diffDays = (checkInMs - t) / 86_400_000;
    if (diffDays >= 0) {
      leadSum += diffDays;
      leadN++;
    }
  }
  const cancellationRate = bookedCount === 0 ? null : cancelledCount / bookedCount;
  const leadTimeDays = leadN === 0 ? null : leadSum / leadN;
  return { bookedCount, cancelledCount, cancellationRate, leadTimeDays };
}

/** Pace: stayPeriod vs priorYearStayPeriod pada asOf. */
export function computePaceKpis(
  input: KpiInput,
  stayPeriod: Period,
  priorYearStayPeriod: Period,
  asOf: Date,
): PaceKpis {
  const baseCurrency = input.baseCurrency ?? "IDR";
  validatePeriod(stayPeriod, "stayPeriod");
  validatePeriod(priorYearStayPeriod, "priorYearStayPeriod");
  for (const b of input.bookings) validateBooking(b, baseCurrency);

  const priorAsOf = new Date(asOf.getTime());
  priorAsOf.setUTCFullYear(priorAsOf.getUTCFullYear() - 1);

  let upcomingBookings = 0;
  let priorBookings = 0;
  let upcomingRev = zero(baseCurrency);
  let priorRev = zero(baseCurrency);

  for (const b of input.bookings) {
    if (!b.bookedAt) continue;
    const stayNights = nightsInPeriod(b.checkIn, b.checkOut, stayPeriod.start, stayPeriod.end);
    if (stayNights.length > 0 && b.bookedAt.getTime() <= asOf.getTime()) {
      upcomingBookings++;
      const totalNights = Math.max(1, daysBetween(b.checkIn, b.checkOut));
      const proportion = stayNights.length / totalNights;
      upcomingRev = add(upcomingRev, mul(b.grossAmount, proportion));
    }
    const priorNights = nightsInPeriod(
      b.checkIn,
      b.checkOut,
      priorYearStayPeriod.start,
      priorYearStayPeriod.end,
    );
    if (priorNights.length > 0 && b.bookedAt.getTime() <= priorAsOf.getTime()) {
      priorBookings++;
      const totalNights = Math.max(1, daysBetween(b.checkIn, b.checkOut));
      const proportion = priorNights.length / totalNights;
      priorRev = add(priorRev, mul(b.grossAmount, proportion));
    }
  }

  const bookingPaceRatio = priorBookings === 0 ? null : upcomingBookings / priorBookings;
  const revenuePaceRatio = priorRev.amount.isZero()
    ? null
    : upcomingRev.amount.dividedBy(priorRev.amount).toNumber();

  return {
    upcomingBookings,
    priorYearBookings: priorBookings,
    bookingPaceRatio,
    upcomingRevenue: upcomingRev,
    priorYearRevenue: priorRev,
    revenuePaceRatio,
  };
}
