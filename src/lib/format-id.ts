/**
 * Formatter id-ID (Indonesia).
 * Sumber kebenaran: docs/05 §1 (format mata uang, pembulatan) dan docs/07.
 * Format ini dipakai untuk tampilan UI dan laporan; nilai numerik tetap Decimal.
 */
import { Decimal } from "./decimal";

/**
 * Formatter untuk IDR (rupiah). Default 0 desimal karena IDR tidak punya sub-unit.
 * id-ID memformat ribuan dengan titik dan desimal dengan koma.
 * Contoh: 1500000 -> "Rp 1.500.000", 1500000.5 -> "Rp 1.500.001" (fractionDigits: 0).
 */
export function formatIDR(
  amount: Decimal | number | string,
  options: { fractionDigits?: 0 | 2 } = {},
): string {
  const fractionDigits = options.fractionDigits ?? 0;
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const value = amount instanceof Decimal ? amount.toNumber() : Number(amount);
  return formatter.format(value);
}

/** Formatter untuk USD. Default 2 desimal. id-ID locale -> "US$ 1.500,00". */
export function formatUSD(
  amount: Decimal | number | string,
  options: { fractionDigits?: 0 | 2 } = {},
): string {
  const fractionDigits = options.fractionDigits ?? 2;
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const value = amount instanceof Decimal ? amount.toNumber() : Number(amount);
  return formatter.format(value);
}

/** Format mata uang generik sesuai Currency. */
export function formatCurrency(
  amount: Decimal | number | string,
  currency: "IDR" | "USD",
  options: { fractionDigits?: 0 | 2 } = {},
): string {
  return currency === "IDR" ? formatIDR(amount, options) : formatUSD(amount, options);
}

/** Format angka generik dengan locale Indonesia. Contoh: 1500000.5 -> "1.500.000,5". */
export function formatNumberId(
  n: Decimal | number,
  options: { fractionDigits?: number } = {},
): string {
  const value = n instanceof Decimal ? n.toNumber() : n;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: options.fractionDigits ?? 0,
    maximumFractionDigits: options.fractionDigits ?? 20,
  }).format(value);
}

/** Format persentase 0..1 -> "15,0%". fractionDigits default 1. */
export function formatPercentId(
  p: Decimal | number,
  options: { fractionDigits?: number } = {},
): string {
  const value = p instanceof Decimal ? p.toNumber() : p;
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    minimumFractionDigits: options.fractionDigits ?? 1,
    maximumFractionDigits: options.fractionDigits ?? 1,
  }).format(value);
}
