/**
 * Parser CSV Reservasi Airbnb (S5-02).
 *
 * Menerima konten CSV hasil ekspor dari extranet Airbnb dan menghasilkan ParsedBookingEvent[].
 * Bersifat murni dan deterministik (AGENTS.md aturan 3).
 */
import type { ParsedBookingEvent, BookingStatus, EventType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export interface ParseReservationsOptions {
  filename?: string;
}

export function parseAirbnbReservationsCsv(
  content: string,
  options: ParseReservationsOptions = {},
): { events: ParsedBookingEvent[]; errors: string[] } {
  void options;
  const rows = parseCsvRows(content);
  const events: ParsedBookingEvent[] = [];
  const errors: string[] = [];

  // Cari baris header (abaikan baris komentar seperti # SINTETIS)
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row[0]?.startsWith("#")) continue;
    const joined = row.map((c) => c.toLowerCase().trim()).join(",");
    if (joined.includes("confirmation code") || joined.includes("kode konfirmasi")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Airbnb tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    code: header.findIndex((h) => h.includes("confirmation") || h.includes("konfirmasi")),
    status: header.findIndex((h) => h === "status"),
    guest: header.findIndex((h) => h.includes("guest") || h.includes("tamu")),
    startDate: header.findIndex((h) => h.includes("start") || h.includes("mulai")),
    endDate: header.findIndex((h) => h.includes("end") || h.includes("selesai")),
    nights: header.findIndex((h) => h.includes("night") || h.includes("malam")),
    bookedAt: header.findIndex((h) => h.includes("booked") || h.includes("dipesan")),
    listing: header.findIndex((h) => h.includes("listing") || h.includes("properti")),
    earnings: header.findIndex(
      (h) => h.includes("earnings") || h.includes("pendapatan") || h.includes("amount"),
    ),
    currency: header.findIndex((h) => h.includes("currency") || h.includes("mata uang")),
  };

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c) => c.trim() === "")) continue;

    const externalId = colIndex.code >= 0 ? row[colIndex.code]?.trim() : undefined;
    if (!externalId) continue;

    const rawStatus = (colIndex.status >= 0 ? (row[colIndex.status] ?? "") : "")
      .toLowerCase()
      .trim();
    let status: BookingStatus = "CONFIRMED";
    let eventType: EventType = "CREATED";

    if (rawStatus.includes("cancel") || rawStatus.includes("batal")) {
      status = "CANCELLED";
      eventType = "CANCELLED";
    } else if (rawStatus.includes("pending") || rawStatus.includes("menunggu")) {
      status = "PENDING";
      eventType = "CREATED";
    } else if (rawStatus.includes("show") || rawStatus.includes("tidakhadir")) {
      status = "NO_SHOW";
      eventType = "NO_SHOW";
    }

    const checkInRaw = (colIndex.startDate >= 0 ? (row[colIndex.startDate] ?? "") : "").trim();
    const checkOutRaw = (colIndex.endDate >= 0 ? (row[colIndex.endDate] ?? "") : "").trim();

    // Normalisasi tanggal (YYYY-MM-DD)
    const checkIn = isStayDate(checkInRaw) ? (checkInRaw as StayDate) : undefined;
    const checkOut = isStayDate(checkOutRaw) ? (checkOutRaw as StayDate) : undefined;

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out tidak valid (${checkInRaw} / ${checkOutRaw})`,
      );
      continue;
    }

    const nights = nightsBetween(checkIn, checkOut);
    const guestName = colIndex.guest >= 0 ? row[colIndex.guest]?.trim() : undefined;
    const listingName = colIndex.listing >= 0 ? row[colIndex.listing]?.trim() : undefined;

    // Bersihkan nominal pendapatan
    let grossAmount = "0.00";
    const rawEarnings = colIndex.earnings >= 0 ? row[colIndex.earnings] : undefined;
    if (rawEarnings) {
      const cleaned = rawEarnings.replace(/[^0-9.-]/g, "");
      if (cleaned) grossAmount = Number.parseFloat(cleaned).toFixed(2);
    }

    const rawCurrency = colIndex.currency >= 0 ? row[colIndex.currency]?.trim() : undefined;
    const currency = rawCurrency ? rawCurrency.toUpperCase() : "IDR";

    events.push({
      eventType,
      confidence: "high",
      warnings: [],
      booking: {
        channel: "AIRBNB",
        externalId,
        listingName,
        status,
        checkIn,
        checkOut,
        nights,
        guestName,
        currency,
        grossAmount,
        collectType: "CHANNEL_COLLECT",
      },
    });
  }

  return { events, errors };
}
