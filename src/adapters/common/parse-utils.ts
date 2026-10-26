/**
 * Utilitas Parser Umum untuk Adapter OTA (S11-Bugfix).
 *
 * Menangani variasi format angka (titik ribuan Indonesia vs koma ribuan internasional)
 * dan format tanggal multi-locale dari berbagai extranet OTA secara deterministik dan murni.
 */
import { Decimal } from "@/lib/decimal";
import { isStayDate, type StayDate } from "@/lib/dates";
import { tryParseLocalizedDate } from "@/adapters/csv-generic/date-parser";

/**
 * Normalisasi nominal uang dari teks mentah OTA menjadi string Decimal (2 desimal).
 *
 * Contoh:
 * - "15.000.000" -> "15000000.00" (titik ribuan Indonesia)
 * - "15.000.000,50" -> "15000000.50"
 * - "15,000,000.50" -> "15000000.50" (koma ribuan US)
 * - "Rp 850.000" -> "850000.00"
 * - "$1,250.00" -> "1250.00"
 * - "(500.000)" -> "-500000.00"
 */
export function parseOtaAmount(raw: string | number | Decimal | null | undefined): string {
  if (raw === null || raw === undefined) return "0.00";
  if (raw instanceof Decimal) return raw.toFixed(2);
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "0.00";
    return new Decimal(raw).toFixed(2);
  }

  let s = String(raw).trim();
  if (s === "") return "0.00";

  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith("-")) {
    isNegative = true;
    s = s.slice(1).trim();
  }

  // Bersihkan simbol mata uang
  s = s.replace(/^(Rp\.?|IDR|USD|\$|EUR|€|GBP|£|AUD|SGD)\s*/i, "");
  s = s.replace(/\s*(IDR|USD|EUR|GBP|AUD|SGD)$/i, "");
  s = s.trim();

  // Buang karakter non-angka kecuali koma dan titik
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return "0.00";

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let normalized = s;

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Format Indonesia / Eropa: 15.000.000,50 -> 15000000.50
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Format US / UK: 15,000,000.50 -> 15000000.50
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Pemisah ribuan berulang: 15,000,000 -> 15000000
      normalized = s.replace(/,/g, "");
    } else {
      const parts = s.split(",");
      // Jika setelah koma ada tepat 3 digit dan sebelum koma 1-3 digit (mis. "15,000" atau "850,000")
      if (
        parts[1] &&
        parts[1].length === 3 &&
        parts[0] &&
        parts[0].length >= 1 &&
        parts[0].length <= 3
      ) {
        normalized = s.replace(/,/g, "");
      } else {
        // Desimal: 15000,50 -> 15000.50
        normalized = s.replace(",", ".");
      }
    }
  } else if (hasDot && !hasComma) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Pemisah ribuan berulang Indonesia: 15.000.000 -> 15000000
      normalized = s.replace(/\./g, "");
    } else {
      const parts = s.split(".");
      // Jika tepat 3 digit setelah titik (mis. 15.000 atau 850.000): pemisah ribuan
      if (
        parts[1] &&
        parts[1].length === 3 &&
        parts[0] &&
        parts[0].length >= 1 &&
        parts[0].length <= 3
      ) {
        normalized = s.replace(/\./g, "");
      } else {
        // Desimal standar: 150.50 atau 15000.5
        normalized = s;
      }
    }
  }

  try {
    let dec = new Decimal(normalized);
    if (dec.isNaN() || !dec.isFinite()) return "0.00";
    if (isNegative && !dec.isZero()) dec = dec.negated();
    return dec.toFixed(2);
  } catch {
    return "0.00";
  }
}

/**
 * Normalisasi tanggal dari berbagai format ekspor extranet OTA menjadi StayDate (YYYY-MM-DD).
 */
export function parseOtaDate(raw: string | undefined | null): StayDate | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Jika sudah ISO YYYY-MM-DD
  if (isStayDate(trimmed)) return trimmed as StayDate;

  // Coba parse dengan parser tanggal multi-format (DD/MM/YYYY, MM/DD/YYYY, D MMM YYYY, dsb.)
  const parsed = tryParseLocalizedDate(trimmed, "AUTO");
  return parsed ?? undefined;
}
