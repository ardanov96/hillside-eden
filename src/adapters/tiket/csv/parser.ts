/**
 * Parser CSV Reservasi Tiket.com TIX Extranet (S6-02).
 *
 * Menerima CSV ekspor reservasi dari TIX Hotel dan menghasilkan ParsedBookingEvent[].
 * Deterministik dan murni (AGENTS.md aturan 3).
 */
import type { ParsedBookingEvent, BookingStatus, EventType, CollectType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export function parseTiketReservationsCsv(content: string): {
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
    if (joined.includes("order id") || joined.includes("no. pesanan")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Tiket.com tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    orderId: header.findIndex((h) => h.includes("order id") || h.includes("no. pesanan")),
    guest: header.findIndex((h) => h.includes("tamu") || h.includes("guest")),
    room: header.findIndex((h) => h.includes("kamar") || h.includes("room") || h.includes("tipe")),
    checkIn: header.findIndex((h) => h.includes("check in") || h.includes("checkin")),
    checkOut: header.findIndex((h) => h.includes("check out") || h.includes("checkout")),
    total: header.findIndex(
      (h) => h.includes("total") || h.includes("tarif") || h.includes("rate"),
    ),
    status: header.findIndex((h) => h.includes("status")),
    payment: header.findIndex((h) => h.includes("metode") || h.includes("payment")),
    currency: header.findIndex((h) => h.includes("mata uang") || h.includes("currency")),
  };

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c) => c.trim() === "")) continue;

    const externalId = colIndex.orderId >= 0 ? row[colIndex.orderId]?.trim() : undefined;
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
    const listingName =
      colIndex.room >= 0 ? row[colIndex.room]?.trim() : "Hillside Eden Bali - Estate (Tiket.com)";

    let grossAmount = "0.00";
    const rawTotal = colIndex.total >= 0 ? row[colIndex.total] : undefined;
    if (rawTotal) {
      const cleaned = rawTotal.replace(/[^0-9.-]/g, "");
      if (cleaned) grossAmount = Number.parseFloat(cleaned).toFixed(2);
    }

    const rawPayment = (colIndex.payment >= 0 ? (row[colIndex.payment] ?? "") : "").toUpperCase();
    let collectType: CollectType = "CHANNEL_COLLECT";
    if (rawPayment.includes("HOTEL") || rawPayment.includes("PROPERTY")) {
      collectType = "HOTEL_COLLECT";
    }

    const rawCurrency = colIndex.currency >= 0 ? row[colIndex.currency]?.trim() : undefined;
    const currency = rawCurrency ? rawCurrency.toUpperCase() : "IDR";

    events.push({
      eventType,
      confidence: "high",
      warnings: [],
      booking: {
        channel: "TIKET_COM",
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
