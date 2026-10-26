/**
 * Parser CSV Reservasi Agoda YCS Extranet.
 *
 * Menerima CSV ekspor reservasi dari Agoda YCS Extranet dan menghasilkan ParsedBookingEvent[].
 * Deterministik dan murni (AGENTS.md aturan 3).
 */
import type { ParsedBookingEvent, BookingStatus, EventType, CollectType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export function parseAgodaReservationsCsv(content: string): {
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
      (joined.includes("booking id") || joined.includes("reference id")) &&
      (joined.includes("check-in") ||
        joined.includes("total inclusive rate") ||
        joined.includes("customer"))
    ) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Agoda YCS tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    bookingId: header.findIndex(
      (h) => h.includes("booking id") || h.includes("reference id") || h.includes("booking no"),
    ),
    guest: header.findIndex(
      (h) => h.includes("customer") || h.includes("guest") || h.includes("lead guest"),
    ),
    room: header.findIndex(
      (h) => h.includes("room type") || h.includes("room") || h.includes("rate plan"),
    ),
    checkIn: header.findIndex(
      (h) => h.includes("check-in") || h.includes("checkin") || h.includes("arrival"),
    ),
    checkOut: header.findIndex(
      (h) => h.includes("check-out") || h.includes("checkout") || h.includes("departure"),
    ),
    total: header.findIndex(
      (h) =>
        h.includes("total inclusive") ||
        h.includes("total amount") ||
        h.includes("total rate") ||
        h.includes("inclusive rate"),
    ),
    commission: header.findIndex((h) => h.includes("commission") || h.includes("komisi")),
    status: header.findIndex((h) => h.includes("status")),
    payment: header.findIndex(
      (h) => h.includes("payment model") || h.includes("payment") || h.includes("channel collect"),
    ),
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
    } else if (rawStatus.includes("pending") || rawStatus.includes("wait")) {
      status = "PENDING";
      eventType = "CREATED";
    }

    const checkInRaw = (colIndex.checkIn >= 0 ? (row[colIndex.checkIn] ?? "") : "").trim();
    const checkOutRaw = (colIndex.checkOut >= 0 ? (row[colIndex.checkOut] ?? "") : "").trim();

    const checkIn = isStayDate(checkInRaw) ? (checkInRaw as StayDate) : undefined;
    const checkOut = isStayDate(checkOutRaw) ? (checkOutRaw as StayDate) : undefined;

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out Agoda tidak valid (${checkInRaw} / ${checkOutRaw})`,
      );
      continue;
    }

    const nights = Math.max(1, nightsBetween(checkIn, checkOut));
    const guestName = colIndex.guest >= 0 ? row[colIndex.guest]?.trim() : undefined;
    const listingName =
      colIndex.room >= 0 && row[colIndex.room]?.trim()
        ? row[colIndex.room]!.trim()
        : "Hillside Eden (Agoda)";

    let grossAmount = "0.00";
    const rawTotal = colIndex.total >= 0 ? row[colIndex.total] : undefined;
    if (rawTotal) {
      const cleaned = rawTotal.replace(/[^0-9.-]/g, "");
      if (cleaned) grossAmount = Number.parseFloat(cleaned).toFixed(2);
    }

    let commissionAmount: string | undefined;
    const rawComm = colIndex.commission >= 0 ? row[colIndex.commission] : undefined;
    if (rawComm) {
      const cleanedComm = rawComm.replace(/[^0-9.-]/g, "");
      if (cleanedComm) commissionAmount = Number.parseFloat(cleanedComm).toFixed(2);
    }

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
        channel: "AGODA",
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
