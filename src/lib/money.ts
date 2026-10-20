/**
 * Modul money: primitif uang berbasis Decimal (presisi penuh).
 * Sumber kebenaran: docs/05 §1 (pembulatan 2 desimal, sisa ke elemen terakhir), docs/04 Decimal(18,2).
 * Tidak ada float di modul ini; semua angka lewat Decimal.
 */
import { Decimal } from "./decimal";

export const SUPPORTED_CURRENCIES = ["IDR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  amount: Decimal;
  currency: Currency;
}

export type MoneyInput = Decimal | number | string;

export type RoundingMode = "half-up" | "half-even" | "down" | "up";

function toDecimal(v: MoneyInput): Decimal {
  return v instanceof Decimal ? v : new Decimal(v);
}

export function money(amount: MoneyInput, currency: Currency): Money {
  return { amount: toDecimal(amount), currency };
}

export function zero(currency: Currency = "IDR"): Money {
  return { amount: new Decimal(0), currency };
}

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return { amount: a.amount.plus(b.amount), currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return { amount: a.amount.minus(b.amount), currency: a.currency };
}

export function mul(a: Money, factor: MoneyInput): Money {
  return { amount: a.amount.times(toDecimal(factor)), currency: a.currency };
}

export function div(a: Money, divisor: MoneyInput): Money {
  const d = toDecimal(divisor);
  if (d.isZero()) throw new Error("Division by zero");
  return { amount: a.amount.dividedBy(d), currency: a.currency };
}

export function neg(a: Money): Money {
  return { amount: a.amount.negated(), currency: a.currency };
}

export function sum(items: Money[], currency: Currency = "IDR"): Money {
  const acc = zero(currency);
  return items.reduce((acc2, m) => add(acc2, m), acc);
}

export function isZero(m: Money): boolean {
  return m.amount.isZero();
}
export function isPositive(m: Money): boolean {
  return m.amount.isPositive() && !m.amount.isZero();
}
export function isNegative(m: Money): boolean {
  return m.amount.isNegative();
}
export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount.equals(b.amount);
}
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b);
  const c = a.amount.comparedTo(b.amount);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}

export function round(a: Money, places = 2, mode: RoundingMode = "half-up"): Money {
  const decimalPlaces = Math.max(0, Math.floor(places));
  const rounding = toRoundingNumber(mode);
  const rounded = a.amount.toDecimalPlaces(decimalPlaces, rounding);
  return { amount: rounded, currency: a.currency };
}

/** Map mode kita ke konstanta Decimal.js (0..8). Lihat Decimal.ROUND_*. */
type DecimalRounding = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
function toRoundingNumber(mode: RoundingMode): DecimalRounding {
  switch (mode) {
    case "up":
      return 0;
    case "down":
      return 1;
    case "half-up":
      return 4;
    case "half-even":
      return 6;
  }
}

/**
 * Alokasi rata: bagi amount ke N slot; sisa pembulatan ke slot terakhir.
 * docs/05 §2 golden case: 3.000.001 IDR / 3 -> [1.000.000, 1.000.000, 1.000.001].
 * USD 100.00 / 3 -> [33.33, 33.33, 33.34]. Total hasil == amount.
 */
export function allocateEvenly(amount: Money, parts: number, places = 2): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error(`parts must be a positive integer, got ${parts}`);
  }
  if (parts === 1) return [round(amount, places)];
  const base = amount.amount.dividedBy(parts).toDecimalPlaces(places, toRoundingNumber("half-up"));
  const slice = money(base, amount.currency);
  const slices: Money[] = Array.from({ length: parts - 1 }, () => slice);
  const distributed = sum(slices, amount.currency);
  const remainder = sub(amount, distributed);
  slices.push(round(remainder, places));
  return slices;
}

/**
 * Alokasi terbobot: bobot bilangan bulat >= 0; sisa ke elemen terakhir.
 * docs/05 §3: bobot default 1 (sama rata) bila tidak ada ListingUnit.allocationWeight.
 */
export function allocateByWeights(amount: Money, weights: number[], places = 2): Money[] {
  if (weights.length === 0) throw new Error("weights must not be empty");
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`weights must be non-negative finite, got ${w}`);
    }
  }
  const totalWeight = weights.reduce((acc2, w) => acc2 + w, 0);
  if (totalWeight === 0) throw new Error("sum of weights must be > 0");
  const slices: Money[] = [];
  for (let i = 0; i < weights.length - 1; i++) {
    const weight = weights[i];
    if (weight === undefined) continue; // noUncheckedIndexedAccess guard
    const share = amount.amount
      .times(weight)
      .dividedBy(totalWeight)
      .toDecimalPlaces(places, toRoundingNumber("half-up"));
    slices.push(money(share, amount.currency));
  }
  const distributed = sum(slices, amount.currency);
  const remainder = sub(amount, distributed);
  slices.push(round(remainder, places));
  return slices;
}

/**
 * Konversi mata uang dengan kurs (berapa unit `to` per 1 unit `from`).
 * Presisi penuh, pembulatan dilakukan terpisah via round() saat simpan/tampil.
 */
export function convert(amount: Money, to: Currency, rate: MoneyInput): Money {
  if (amount.currency === to) return amount;
  const converted = mul(amount, rate);
  return { amount: converted.amount, currency: to };
}

/** Parse string angka (id-ID atau en-US) menjadi Decimal. Mendukung "1.500.000,00" dan "1,500,000.00". */
export function parseMoney(input: string): Decimal {
  const trimmed = input.trim();
  if (trimmed === "") throw new Error("empty money string");
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;
  if (hasComma && hasDot) {
    // Asumsikan id-ID: titik=ribuan, koma=desimal. Contoh: "1.500.000,00".
    if (trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      // en-US: koma=ribuan, titik=desimal. Contoh: "1,500,000.00".
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Hanya koma: kalau ada lebih dari satu koma -> ribuan (en-US).
    // Satu koma dengan 1-2 digit di kanan -> desimal id-ID.
    const parts = trimmed.split(",");
    if (parts.length > 2) {
      normalized = trimmed.replace(/,/g, "");
    } else if (parts[1] && parts[1].length <= 2) {
      normalized = parts[0] + "." + parts[1];
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else {
    // Hanya titik atau tidak ada: id-ID punya titik ribuan.Buang.
    if (hasDot && trimmed.split(".").length > 2) {
      normalized = trimmed.replace(/\./g, "");
    }
  }
  return new Decimal(normalized);
}
