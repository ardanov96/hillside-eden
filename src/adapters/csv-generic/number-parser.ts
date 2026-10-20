/**
 * Parser Angka Sesuai Locale (id-ID vs en-US).
 * Sumber kebenaran: docs/06-ingestion-and-adapters.md §7, tiket S2-05.
 *
 * Persyaratan DoD S2-05:
 * - Locale Indonesia: titik (.) sebagai pemisah ribuan, koma (,) sebagai pemisah desimal.
 *   Contoh: "1.500.000,00" -> Decimal(1500000.00).
 * - Locale Internasional: koma (,) sebagai pemisah ribuan, titik (.) sebagai pemisah desimal.
 *   Contoh: "1,500,000.00" -> Decimal(1500000.00).
 * - Tidak menebak diam-diam; deteksi dikendalikan oleh numberLocale profil (docs/06 §7).
 */

import { Decimal } from "../../lib/decimal";
import type { NumberLocale } from "./profile";

/**
 * Membersihkan awalan simbol mata uang, spasi, dan menangani angka negatif dalam tanda kurung.
 */
function cleanNumberString(val: string): { cleaned: string; isNegative: boolean } {
  let s = val.trim();

  // Deteksi angka negatif dalam tanda kurung: (1.500.000) -> -1500000
  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith("-")) {
    isNegative = true;
    s = s.slice(1).trim();
  }

  // Buang simbol mata uang umum dan teks non-angka di awal/akhir
  s = s.replace(/^(Rp\.?|IDR|USD|\$|EUR|€|GBP|£|AUD|SGD)\s*/i, "");
  s = s.replace(/\s*(IDR|USD|EUR|GBP|AUD|SGD)$/i, "");
  s = s.trim();

  return { cleaned: s, isNegative };
}

/**
 * Melakukan parsing string angka sesuai locale yang ditentukan.
 * Melempar error bila format tidak valid.
 */
export function parseLocalizedNumber(
  value: string | number | Decimal,
  locale: NumberLocale,
): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Invalid number: ${value}`);
    return new Decimal(value);
  }

  const { cleaned, isNegative } = cleanNumberString(value);
  if (cleaned === "") {
    throw new Error(`parseLocalizedNumber: empty number string from input "${value}"`);
  }

  let normalized = cleaned;

  if (locale === "id-ID") {
    // id-ID: titik = ribuan, koma = desimal
    // Validasi: tidak boleh ada pola ribuan yang salah jika ada titik
    // Hapus titik ribuan, ganti koma desimal menjadi titik
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (locale === "en-US") {
    // en-US: koma = ribuan, titik = desimal
    // Hapus koma ribuan
    normalized = cleaned.replace(/,/g, "");
  }

  try {
    let result = new Decimal(normalized);
    if (result.isNaN() || !result.isFinite()) {
      throw new Error("Resulting Decimal is NaN or Infinite");
    }
    if (isNegative && !result.isZero()) {
      result = result.negated();
    }
    return result;
  } catch {
    throw new Error(`parseLocalizedNumber: Gagal mengurai "${value}" dengan locale "${locale}"`);
  }
}

/**
 * Versi aman (Safe): mengembalikan null bila string kosong atau tidak dapat diurai.
 */
export function tryParseLocalizedNumber(
  value: string | number | Decimal | null | undefined,
  locale: NumberLocale,
): Decimal | null {
  if (value === null || value === undefined) return null;
  const s = typeof value === "string" ? value.trim() : String(value);
  if (s === "") return null;

  try {
    return parseLocalizedNumber(value, locale);
  } catch {
    return null;
  }
}
