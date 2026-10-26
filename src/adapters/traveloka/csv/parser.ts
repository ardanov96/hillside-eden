/**
 * Parser CSV Reservasi Traveloka TERA Extranet (S6-03).
 */
import type { ParsedBookingEvent, BookingStatus, EventType, CollectType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { nightsBetween } from "@/lib/dates";
import { parseOtaAmount, parseOtaDate } from "@/adapters/common/parse-utils";

export function parseTravelokaReservationsCsv(content: string): {
  events: ParsedBookingEvent[];
  errors: string[];
} {
  const rows = parseCsvRows(content);
  const events: ParsedBookingEvent[] = [];
  const errors: string[] = [];

  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row[0]?.startsWith("#")) continue;
    const joined = row.map((c) => c.toLowerCase().trim()).join(",");
    if (
      joined.includes("booking id") ||
      joined.includes("no. pemesanan") ||
      joined.includes("itinerary id")
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Traveloka tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    bookingId: header.findIndex(
      (h) => h.includes("booking id") || h.includes("pemesanan") || h.includes("itinerary"),
    ),
    guest: header.findIndex((h) => h.includes("guest") || h.includes("tamu") || h.includes("name")),
    room: header.findIndex((h) => h.includes("room") || h.includes("kamar") || h.includes("tipe")),
    property: header.findIndex(
      (h) => h.includes("property") || h.includes("properti") || h.includes("hotel"),
    ),
    checkIn: header.findIndex(
      (h) => h.includes("check-in") || h.includes("checkin") || h.includes("masuk"),
    ),
    checkOut: header.findIndex(
      (h) => h.includes("check-out") || h.includes("checkout") || h.includes("keluar"),
    ),
    total: header.findIndex(
      (h) =>
        h.includes("total") || h.includes("amount") || h.includes("tarif") || h.includes("price"),
    ),
    status: header.findIndex((h) => h.includes("status")),
    payment: header.findIndex((h) => h.includes("payment") || h.includes("bayar")),
    currency: header.findIndex((h) => h.includes("currency") || h.includes("mata uang")),
  };

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c) => c.trim() === "")) continue;

    const externalId = colIndex.bookingId >= 0 ? row[colIndex.bookingId]?.trim() : undefined;
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
    }

    const checkInRaw = (colIndex.checkIn >= 0 ? (row[colIndex.checkIn] ?? "") : "").trim();
    const checkOutRaw = (colIndex.checkOut >= 0 ? (row[colIndex.checkOut] ?? "") : "").trim();

    const checkIn = parseOtaDate(checkInRaw);
    const checkOut = parseOtaDate(checkOutRaw);

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out tidak valid (${checkInRaw} / ${checkOutRaw})`,
      );
      continue;
    }

    const nights = nightsBetween(checkIn, checkOut);
    const guestName = colIndex.guest >= 0 ? row[colIndex.guest]?.trim() : undefined;
    const listingName =
      colIndex.property >= 0 && row[colIndex.property]?.trim()
        ? row[colIndex.property]!.trim()
        : "Hillside Eden Bali - Estate (Traveloka)";

    const grossAmount = parseOtaAmount(colIndex.total >= 0 ? row[colIndex.total] : undefined);

    const rawPayment = (colIndex.payment >= 0 ? (row[colIndex.payment] ?? "") : "").toUpperCase();
    let collectType: CollectType = "CHANNEL_COLLECT";
    if (
      rawPayment.includes("HOTEL") ||
      rawPayment.includes("PAY AT HOTEL") ||
      rawPayment.includes("PROPERTY")
    ) {
      collectType = "HOTEL_COLLECT";
    }

    const rawCurrency = colIndex.currency >= 0 ? row[colIndex.currency]?.trim() : undefined;
    const currency = rawCurrency ? rawCurrency.toUpperCase() : "IDR";

    events.push({
      eventType,
      confidence: "high",
      warnings: [],
      booking: {
        channel: "TRAVELOKA",
        externalId,
        listingName,
        status,
        checkIn,
        checkOut,
        nights,
        guestName,
        currency,
        grossAmount,
        collectType,
      },
    });
  }

  return { events, errors };
}
