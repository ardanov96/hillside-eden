/**
 * Parser CSV Reservasi Agoda (YCS Extranet & Agoda Partner Portal).
 *
 * Ekspor Agoda "Reservasi" bisa downloaded dengan kombinasi kolom yang
 * berbeda-beda dan pengguna bebas memfilter kolom saat ekspor. Karena itu
 * parser ini bekerja berdasarkan NAMA KOLOM (header), bukan posisi kolom:
 * setiap kolom yang tersedia dipetakan ke field logis lewat alias
 * (lihat ./mappings.ts).
 *
 * Prinsip:
 * - Murni & deterministik (AGENTS.md aturan 3): tanpa I/O, tanpa LLM, tanpa
 *   jaringan, tanpa jam dinding.
 * - Uang selalu Decimal string (2 desimal) lewat parseOtaAmount.
 * - Tanggal menginap bertipe StayDate ("YYYY-MM-DD") zona WITA.
 */
import type {
  ParsedBookingEvent,
  BookingStatus,
  CollectType,
  ConfidenceLevel,
  EventType,
} from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { daysBetween, fromStayDate, type StayDate } from "@/lib/dates";
import { parseOtaAmount, parseOtaDate } from "@/adapters/common/parse-utils";
import {
  detectAgodaHeaderRow,
  inferAgodaDateOrder,
  mapAgodaCollectType,
  mapAgodaColumns,
  mapAgodaCountryCode,
  mapAgodaStatus,
  type AgodaField,
} from "./mappings";

export interface AgodaParseResult {
  events: ParsedBookingEvent[];
  errors: string[];
}

/**
 * Parse CSV ekspor reservasi Agoda.
 *
 * Mengembalikan daftar event + daftar error per baris. Baris yang tidak bisa
 * diparse dilewati (tidak menghentikan seluruh batch); bila tidak ada baris
 * pun yang berhasil, `errors` menjelaskan penyebabnya.
 */
export function parseAgodaReservationsCsv(content: string): AgodaParseResult {
  const rows = parseCsvRows(content);
  const events: ParsedBookingEvent[] = [];
  const errors: string[] = [];

  const header = detectAgodaHeaderRow(rows);
  if (!header) {
    return {
      events: [],
      errors: [
        "Header ekspor reservasi Agoda tidak ditemukan. Pastikan kolom ID reservasi " +
          "(Booking ID / BookingIDExternal_reference_ID) ada di berkas.",
      ],
    };
  }

  const columns = mapAgodaColumns(header.headers);

  if (columns.bookingId < 0) {
    return {
      events: [],
      errors: ["Kolom ID reservasi Agoda tidak ditemukan pada berkas yang diimpor."],
    };
  }
  if (columns.checkIn < 0 || columns.checkOut < 0) {
    return {
      events: [],
      errors: [
        "Kolom tanggal menginap (check-in / check-out) tidak ditemukan. Ekspor ulang " +
          "dengan menyertakan kolom tanggal menginap.",
      ],
    };
  }

  // Deteksi format tanggal (MM/DD/YYYY vs DD/MM/YYYY) dari isi berkas.
  const dateSamples: string[] = [];
  for (let r = header.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (const field of ["checkIn", "checkOut", "bookedDate"] as const) {
      const idx = columns[field];
      if (idx >= 0) dateSamples.push((row[idx] ?? "").trim());
    }
  }
  const dateOrder = inferAgodaDateOrder(dateSamples);

  for (let r = header.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    if (row.every((c) => (c ?? "").trim() === "")) continue;

    const cell = (field: AgodaField): string => {
      const idx = columns[field];
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };

    const externalId = cell("bookingId");
    if (!externalId) {
      errors.push(`Baris ${r + 1}: ID reservasi kosong, baris dilewati.`);
      continue;
    }

    const warnings: string[] = [];

    // --- Status ---
    const statusMapping = mapAgodaStatus(cell("status"));
    const status: BookingStatus = statusMapping.status;
    const eventType: EventType = statusMapping.eventType;
    if (statusMapping.warning) warnings.push(statusMapping.warning);

    // --- Tanggal menginap ---
    const checkInRaw = cell("checkIn");
    const checkOutRaw = cell("checkOut");
    const checkIn = parseOtaDate(checkInRaw, dateOrder);
    const checkOut = parseOtaDate(checkOutRaw, dateOrder);

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out tidak valid (${checkInRaw || "-"} / ${checkOutRaw || "-"}).`,
      );
      continue;
    }
    if (checkOut <= checkIn) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-out (${checkOut}) harus setelah check-in (${checkIn}).`,
      );
      continue;
    }

    const computedNights = daysBetween(checkIn, checkOut);
    const nights = Math.max(1, computedNights);
    if (computedNights !== nights) {
      warnings.push(
        `Durasi 0 malam pada baris ini; diasumsikan ${nights} malam agar alokasi unit valid.`,
      );
    }

    // Jumlah malam dari berkas (bila ada) hanya untuk pembanding.
    const fileNights = parseNonNegativeInt(cell("nights"));
    if (fileNights > 0 && fileNights !== computedNights) {
      warnings.push(
        `Jumlah malam pada berkas (${fileNights}) berbeda dari selisih tanggal (${computedNights}); ` +
          "selisih tanggal yang dipakai.",
      );
    }

    // --- Tanggal pemesanan ---
    const bookedDateRaw = cell("bookedDate");
    const bookedDate = bookedDateRaw ? parseOtaDate(bookedDateRaw, dateOrder) : undefined;
    const bookedAt = bookedDate ? fromStayDate(bookedDate) : undefined;

    // --- Listing ---
    const roomRaw = cell("roomType");
    const propertyRaw = cell("propertyName");
    const listingName = roomRaw || propertyRaw || undefined;
    const externalListingId = extractParenthesizedId(roomRaw);

    // --- Tamu ---
    const guestName = cell("guestName") || undefined;
    const countryCode = mapAgodaCountryCode(cell("nationality"));

    const adults = parseNonNegativeInt(cell("adults"));
    const children = parseNonNegativeInt(cell("children"));
    const guestsTotal = adults + children;
    const guestsCount = guestsTotal > 0 ? guestsTotal : undefined;

    // --- Nominal ---
    const grossRaw = cell("grossAmount");
    const sellRaw = cell("sellInclusive");
    let grossAmount: string | undefined;
    if (grossRaw) {
      grossAmount = parseOtaAmount(grossRaw);
    } else if (sellRaw) {
      grossAmount = parseOtaAmount(sellRaw);
      warnings.push(
        "Kolom total tidak ada pada berkas; nilai ReferenceSellInclusive dipakai sebagai " +
          "pendapatan (perkiraan, perlu dikonfirmasi).",
      );
    }
    if (grossAmount === undefined) {
      grossAmount = "0.00";
      if (status !== "CANCELLED" && status !== "NO_SHOW") {
        warnings.push(
          "Nominal total tidak ditemukan pada berkas; pendapatan dicatat 0 dan perlu dilengkapi manual.",
        );
      }
    }

    const commissionRaw = cell("commission");
    const commissionAmount = commissionRaw ? parseOtaAmount(commissionRaw) : undefined;

    // --- Model pembayaran & mata uang ---
    const collectMapping = mapAgodaCollectType(cell("paymentModel"));
    const collectType: CollectType = collectMapping.collectType;
    if (collectMapping.warning) warnings.push(collectMapping.warning);

    const currency = normalizeCurrency(cell("currency"));

    // --- Acknowledged (tamu belum mengonfirmasi) ---
    const acknowledgedRaw = cell("acknowledged").toLowerCase();
    if (status === "CONFIRMED" && /^(no|n|tidak|belum|false|0)$/.test(acknowledgedRaw)) {
      warnings.push("Reservasi terkonfirmasi tetapi belum di-acknowledge oleh tamu.");
    }

    const rawPayload = buildRawPayload(header.original, row);

    const confidence: ConfidenceLevel =
      warnings.length === 0 ? "high" : warnings.length > 2 ? "low" : "medium";

    events.push({
      eventType,
      confidence,
      warnings,
      booking: {
        channel: "AGODA",
        externalId,
        externalListingId,
        listingName,
        status,
        bookedAt,
        checkIn: checkIn as StayDate,
        checkOut: checkOut as StayDate,
        nights,
        guestsCount,
        guestName,
        countryCode,
        currency,
        grossAmount,
        commissionAmount,
        collectType,
        rawPayload,
      },
    });
  }

  return { events, errors };
}

/** Parse bilangan bulat non-negatif; nilai tidak valid dianggap 0. */
function parseNonNegativeInt(raw: string): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Ekstrak ID listing dari nama tipe kamar, mis. "Rumah (1388437228)" ->
 * "1388437228". kolom RatePlan juga memuat angka ID, tapi itu ID rate plan
 * (bukan ID listing) sehingga tidak boleh dipakai di sini.
 */
function extractParenthesizedId(raw: string): string | undefined {
  if (!raw) return undefined;
  const matches = raw.match(/\((\d{4,})\)/g);
  if (!matches || matches.length === 0) return undefined;
  const last = matches[matches.length - 1]!;
  return last.replace(/[()]/g, "");
}

/** Ambil kode mata uang 3 huruf; default IDR bila tidak dikenali. */
function normalizeCurrency(raw: string): string {
  const m = /^[A-Za-z]{3}/.exec(raw.trim());
  return m ? m[0].toUpperCase() : "IDR";
}

/**
 * Simpan nilai mentah baris dengan nama header asli (untuk audit & penelusuran).
 */
function buildRawPayload(
  headers: readonly string[],
  row: readonly string[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (let c = 0; c < headers.length; c++) {
    const key = headers[c] || `col_${c}`;
    payload[key] = row[c] ?? "";
  }
  return payload;
}
