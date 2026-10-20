/**
 * Modul diff: membandingkan NormalizedBooking event baru dengan Booking
 * yang ada di database, lalu mengembalikan field-field yang berubah.
 *
 * Sumber kebenaran: docs/03 §3.2 (event-sourced update + out-of-order)
 * dan docs/06 §4 (event UPDATE berisi diff).
 *
 * Prinsip:
 * - Murni: tidak ada I/O, tidak ada Prisma. Input dan output deterministic.
 * - Hanya field "bermakna finansial/struktural" yang dibandingkan.
 *   metadata seperti updatedAt/lastSeenAt tidak ikut diff.
 * - Pembulatan Decimal string dibanding per-bita: "100.00" === "100".
 * - Status event di-resolve di pipeline/upsert; diff ini hanya state final.
 */
import { Decimal } from "@/lib/decimal";
import type { BookingStatus, NormalizedBooking } from "@/adapters/types";

/** Field-field yang dibandingkan untuk diff. Keys harus cocok dengan nama kolom Booking. */
export const DIFF_FIELDS = [
  "status",
  "checkIn",
  "checkOut",
  "nights",
  "guestsCount",
  "currency",
  "grossAmount",
  "taxesCollected",
  "cancellationFee",
  "commissionAmount",
  "commissionRate",
  "collectType",
  "fxRateToBase",
] as const;

export type DiffField = (typeof DIFF_FIELDS)[number];

export interface FieldDiff {
  from: unknown;
  to: unknown;
}

export type BookingDiff = Partial<Record<DiffField, FieldDiff>>;

/** Representasi Booking minimal untuk input diff (couple-friendly dengan Prisma row). */
export interface BookingSnapshot {
  status: BookingStatus;
  checkIn: Date | string;
  checkOut: Date | string;
  nights?: number | null;
  guestsCount?: number | null;
  currency: string;
  grossAmount: Decimal | number | string;
  taxesCollected?: Decimal | number | string | null;
  cancellationFee?: Decimal | number | string | null;
  commissionAmount?: Decimal | number | string | null;
  commissionRate?: Decimal | number | string | null;
  collectType?: string | null;
  fxRateToBase?: Decimal | number | string | null;
}

/** Helper: konversi Date/string/Decimal/number menjadi string tanggal "YYYY-MM-DD" bila perlu. */
function toStayDateISO(value: Date | string): string {
  if (value instanceof Date) {
    // Tetap konversi date (UTC midnight) ke "YYYY-MM-DD" dengan method Date.
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // string diasumsikan sudah "YYYY-MM-DD" (db @db.Date) atau sudah ter-normalize.
  return value.slice(0, 10);
}

/** Bandingkan dua nilai desimal dengan toleransi eksak (Decimal.equals). */
function decimalEquals(
  a: Decimal | number | string | null | undefined,
  b: Decimal | number | string | null | undefined,
): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  const da = a instanceof Decimal ? a : new Decimal(a);
  const db = b instanceof Decimal ? b : new Decimal(b);
  return da.equals(db);
}

/** Bandingkan dua nilai angka atau null/undefined. */
function numEquals(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return a === b;
}

/** Bandingkan dua string (case-sensitive). */
function strEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return a === b;
}

/**
 * Hitung diff antara NormalizedBooking event dan snapshot Booking saat ini.
 * Hanya field yang BERUBAH dikembalikan (BookingDiff).
 */
export function diffBooking(before: BookingSnapshot, event: NormalizedBooking): BookingDiff {
  const diff: BookingDiff = {};

  // status
  if (event.status !== before.status) {
    diff.status = { from: before.status, to: event.status };
  }
  // checkIn / checkOut
  const eventCheckIn = toStayDateISO(event.checkIn as unknown as string);
  const beforeCheckIn = toStayDateISO(before.checkIn);
  if (eventCheckIn !== beforeCheckIn) {
    diff.checkIn = { from: beforeCheckIn, to: eventCheckIn };
  }
  const eventCheckOut = toStayDateISO(event.checkOut as unknown as string);
  const beforeCheckOut = toStayDateISO(before.checkOut);
  if (eventCheckOut !== beforeCheckOut) {
    diff.checkOut = { from: beforeCheckOut, to: eventCheckOut };
  }

  // nights (event optional -> pakai computed fallback)
  const eventNights = event.nights;
  if (eventNights !== undefined && !numEquals(eventNights, before.nights ?? null)) {
    diff.nights = { from: before.nights ?? null, to: eventNights };
  }

  // guestsCount (event optional -> skip bila tidak ada perubahan)
  if (
    event.guestsCount !== undefined &&
    !numEquals(event.guestsCount, before.guestsCount ?? null)
  ) {
    diff.guestsCount = { from: before.guestsCount ?? null, to: event.guestsCount };
  }

  // currency (selalu ada di event; bandingkan normalized)
  if (event.currency !== before.currency) {
    diff.currency = { from: before.currency, to: event.currency };
  }

  // grossAmount (event optional untuk CANCELLED, wajib untuk CONFIRMED/PENDING)
  const eventGross = event.grossAmount !== undefined ? new Decimal(event.grossAmount) : null;
  const beforeGross = new Decimal(before.grossAmount);
  if (eventGross !== null && !decimalEquals(eventGross, beforeGross)) {
    diff.grossAmount = { from: beforeGross.toString(), to: eventGross.toString() };
  }

  // taxesCollected
  const eventTax = event.taxesCollected !== undefined ? new Decimal(event.taxesCollected) : null;
  const beforeTax = before.taxesCollected ?? null;
  if (eventTax !== null && !decimalEquals(eventTax, beforeTax)) {
    diff.taxesCollected = {
      from: beforeTax === null ? null : new Decimal(beforeTax).toString(),
      to: eventTax.toString(),
    };
  }

  // cancellationFee
  const eventCancel =
    event.cancellationFee !== undefined ? new Decimal(event.cancellationFee) : null;
  const beforeCancel = before.cancellationFee ?? null;
  if (eventCancel !== null && !decimalEquals(eventCancel, beforeCancel)) {
    diff.cancellationFee = {
      from: beforeCancel === null ? null : new Decimal(beforeCancel).toString(),
      to: eventCancel.toString(),
    };
  }

  // commissionAmount
  const eventCommAmt =
    event.commissionAmount !== undefined ? new Decimal(event.commissionAmount) : null;
  const beforeCommAmt = before.commissionAmount ?? null;
  if (eventCommAmt !== null && !decimalEquals(eventCommAmt, beforeCommAmt)) {
    diff.commissionAmount = {
      from: beforeCommAmt === null ? null : new Decimal(beforeCommAmt).toString(),
      to: eventCommAmt.toString(),
    };
  }

  // commissionRate
  const eventCommRate =
    event.commissionRate !== undefined ? new Decimal(event.commissionRate) : null;
  const beforeCommRate = before.commissionRate ?? null;
  if (eventCommRate !== null && !decimalEquals(eventCommRate, beforeCommRate)) {
    diff.commissionRate = {
      from: beforeCommRate === null ? null : new Decimal(beforeCommRate).toString(),
      to: eventCommRate.toString(),
    };
  }

  // collectType
  if (
    event.collectType !== undefined &&
    !strEquals(event.collectType, before.collectType ?? null)
  ) {
    diff.collectType = { from: before.collectType ?? null, to: event.collectType };
  }

  return diff;
}

/** True bila tidak ada perubahan (semua field identik). */
export function isEmptyDiff(diff: BookingDiff): boolean {
  return Object.keys(diff).length === 0;
}
