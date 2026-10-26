/**
 * Parser CSV Reservasi Expedia Partner Central.
 *
 * Menerima CSV ekspor reservasi dari Expedia Partner Central dan menghasilkan ParsedBookingEvent[].
 * Deterministik dan murni (AGENTS.md aturan 3).
 */
import type { ParsedBookingEvent, BookingStatus, EventType, CollectType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { nightsBetween } from "@/lib/dates";
import { parseOtaAmount, parseOtaDate } from "@/adapters/common/parse-utils";

export function parseExpediaReservationsCsv(content: string): {
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
      (joined.includes("reservation id") ||
        joined.includes("itinerary number") ||
        joined.includes("expedia")) &&
      (joined.includes("stay date") ||
        joined.includes("total booking value") ||
        joined.includes("guest"))
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Expedia tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    reservationId: header.findIndex(
      (h) => h.includes("reservation id") || h.includes("itinerary") || h.includes("booking id"),
    ),
    guest: header.findIndex(
      (h) => h.includes("guest") || h.includes("traveler") || h.includes("name"),
    ),
    room: header.findIndex(
      (h) => h.includes("unit") || h.includes("room") || h.includes("rate plan"),
    ),
    checkIn: header.findIndex(
      (h) =>
        h.includes("stay date start") ||
        h.includes("check-in") ||
        h.includes("checkin") ||
        h.includes("arrival"),
    ),
    checkOut: header.findIndex(
      (h) =>
        h.includes("stay date end") ||
        h.includes("check-out") ||
        h.includes("checkout") ||
        h.includes("departure"),
    ),
    total: header.findIndex(
      (h) =>
        h.includes("total booking") ||
        h.includes("total value") ||
        h.includes("total amount") ||
        h.includes("total rate"),
    ),
    commission: header.findIndex(
      (h) => h.includes("commission") || h.includes("compensation") || h.includes("partner fee"),
    ),
    status: header.findIndex((h) => h.includes("status")),
    payment: header.findIndex(
      (h) => h.includes("payment type") || h.includes("model") || h.includes("payment"),
    ),
    currency: header.findIndex((h) => h.includes("currency") || h.includes("mata uang")),
  };

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c) => c.trim() === "")) continue;

    const externalId =
      colIndex.reservationId >= 0 ? row[colIndex.reservationId]?.trim() : undefined;
    if (!externalId) continue;

    const rawStatus = (colIndex.status >= 0 ? (row[colIndex.status] ?? "") : "")
      .toLowerCase()
      .trim();
    let status: BookingStatus = "CONFIRMED";
    let eventType: EventType = "CREATED";

    if (rawStatus.includes("cancel") || rawStatus.includes("batal")) {
      status = "CANCELLED";
      eventType = "CANCELLED";
    } else if (rawStatus.includes("pending") || rawStatus.includes("wait")) {
      status = "PENDING";
      eventType = "CREATED";
    }

    const checkInRaw = (colIndex.checkIn >= 0 ? (row[colIndex.checkIn] ?? "") : "").trim();
    const checkOutRaw = (colIndex.checkOut >= 0 ? (row[colIndex.checkOut] ?? "") : "").trim();

    const checkIn = parseOtaDate(checkInRaw);
    const checkOut = parseOtaDate(checkOutRaw);

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out Expedia tidak valid (${checkInRaw} / ${checkOutRaw})`,
      );
      continue;
    }

    const nights = Math.max(1, nightsBetween(checkIn, checkOut));
    const guestName = colIndex.guest >= 0 ? row[colIndex.guest]?.trim() : undefined;
    const listingName =
      colIndex.room >= 0 && row[colIndex.room]?.trim()
        ? row[colIndex.room]!.trim()
        : "Hillside Eden (Expedia)";

    const grossAmount = parseOtaAmount(colIndex.total >= 0 ? row[colIndex.total] : undefined);

    const commissionAmount =
      colIndex.commission >= 0 && row[colIndex.commission]?.trim()
        ? parseOtaAmount(row[colIndex.commission])
        : undefined;

    const rawPayment = (colIndex.payment >= 0 ? (row[colIndex.payment] ?? "") : "").toUpperCase();
    let collectType: CollectType = "CHANNEL_COLLECT";
    if (rawPayment.includes("HOTEL") || rawPayment.includes("PROPERTY")) {
      collectType = "HOTEL_COLLECT";
    }

    const currency =
      colIndex.currency >= 0 && row[colIndex.currency]?.trim()
        ? row[colIndex.currency]!.trim().toUpperCase()
        : "IDR";

    const rawPayload: Record<string, unknown> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] || `col_${c}`;
      rawPayload[key] = row[c] ?? "";
    }

    events.push({
      eventType,
      confidence: "high",
      warnings: [],
      booking: {
        channel: "EXPEDIA",
        externalId,
        listingName,
        status,
        checkIn,
        checkOut,
        nights,
        guestName,
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
