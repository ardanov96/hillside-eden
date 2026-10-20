/**
 * Parser Tanggal Multi-Format (Indonesian & International).
 * Sumber kebenaran: docs/06-ingestion-and-adapters.md §7.
 *
 * Format yang didukung minimal:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - D MMM YYYY / D MMMM YYYY (nama bulan Indonesia dan Inggris: "20 Okt 2026", "20 October 2026")
 * - ISO Timestamps (YYYY-MM-DDTHH:mm:ssZ)
 *
 * Keluaran selalu berupa StayDate valid ("YYYY-MM-DD").
 */

import { isStayDate, type StayDate } from "../../lib/dates";
import type { DateFormatPattern } from "./profile";

const MONTH_NAME_MAP: Record<string, number> = {
  // Indonesia
  januari: 1,
  jan: 1,
  februari: 2,
  pebruari: 2,
  feb: 2,
  peb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  ags: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nopember: 11,
  nov: 11,
  nop: 11,
  desember: 12,
  des: 12,

  // English
  january: 1,
  february: 2,
  march: 3,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  aug: 8,
  october: 10,
  oct: 10,
  december: 12,
  dec: 12,
};

function formatStayDate(y: number, m: number, d: number): StayDate {
  const yStr = String(y).padStart(4, "0");
  const mStr = String(m).padStart(2, "0");
  const dStr = String(d).padStart(2, "0");
  const stayDate = `${yStr}-${mStr}-${dStr}`;
  if (!isStayDate(stayDate)) {
    throw new Error(`Invalid calendar date generated: ${stayDate}`);
  }
  return stayDate;
}

/**
 * Parsing string tanggal ke StayDate YYYY-MM-DD.
 */
export function parseLocalizedDate(
  value: string | Date,
  pattern: DateFormatPattern = "AUTO",
): StayDate {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    const d = value.getUTCDate();
    return formatStayDate(y, m, d);
  }

  const raw = value.trim();
  if (raw === "") {
    throw new Error("parseLocalizedDate: string tanggal kosong");
  }

  // 1. Cek langsung bila sudah YYYY-MM-DD atau ISO Timestamp
  if (isStayDate(raw)) {
    return raw;
  }
  if (raw.length >= 10 && raw.includes("T")) {
    const datePart = raw.slice(0, 10);
    if (isStayDate(datePart)) return datePart;
  }

  // Pola YYYY-MM-DD dengan spasi/pemisah lain
  const isoMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(raw);
  if (isoMatch && (pattern === "YYYY-MM-DD" || pattern === "AUTO")) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return formatStayDate(y, m, d);
  }

  // 2. Pola DD/MM/YYYY atau DD-MM-YYYY
  const slashHyphenMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw);
  if (slashHyphenMatch) {
    if (pattern === "MM/DD/YYYY") {
      const m = Number(slashHyphenMatch[1]);
      const d = Number(slashHyphenMatch[2]);
      const y = Number(slashHyphenMatch[3]);
      return formatStayDate(y, m, d);
    }
    // Default atau DD/MM/YYYY atau DD-MM-YYYY
    const d = Number(slashHyphenMatch[1]);
    const m = Number(slashHyphenMatch[2]);
    const y = Number(slashHyphenMatch[3]);
    return formatStayDate(y, m, d);
  }

  // 3. Pola D MMM YYYY / D MMMM YYYY (mis. "20 Okt 2026", "20 Oktober 2026", "5 Aug 2026")
  const namedMonthMatch = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/.exec(raw);
  if (namedMonthMatch) {
    const d = Number(namedMonthMatch[1]);
    const monthStr = namedMonthMatch[2]!.toLowerCase();
    const y = Number(namedMonthMatch[3]);
    const m = MONTH_NAME_MAP[monthStr];
    if (!m) {
      throw new Error(`parseLocalizedDate: Nama bulan "${namedMonthMatch[2]}" tidak dikenali`);
    }
    return formatStayDate(y, m, d);
  }

  // 4. Pola MMM D, YYYY (mis. "Oct 20, 2026")
  const usNamedMatch = /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(raw);
  if (usNamedMatch) {
    const monthStr = usNamedMatch[1]!.toLowerCase();
    const d = Number(usNamedMatch[2]);
    const y = Number(usNamedMatch[3]);
    const m = MONTH_NAME_MAP[monthStr];
    if (!m) {
      throw new Error(`parseLocalizedDate: Nama bulan "${usNamedMatch[1]}" tidak dikenali`);
    }
    return formatStayDate(y, m, d);
  }

  throw new Error(`parseLocalizedDate: Format tanggal "${raw}" tidak didukung`);
}

/**
 * Versi aman (Safe): mengembalikan null bila string tanggal gagal diurai.
 */
export function tryParseLocalizedDate(
  value: string | Date | null | undefined,
  pattern: DateFormatPattern = "AUTO",
): StayDate | null {
  if (value === null || value === undefined) return null;
  try {
    return parseLocalizedDate(value, pattern);
  } catch {
    return null;
  }
}
