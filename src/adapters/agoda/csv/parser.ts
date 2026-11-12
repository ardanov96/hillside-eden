/**
 * Parser CSV Reservasi Agoda YCS Extranet.
 *
 * Menerima CSV ekspor reservasi dari Agoda YCS Extranet dan menghasilkan ParsedBookingEvent[].
 * Deterministik dan murni (AGENTS.md aturan 3).
 */
import type { ParsedBookingEvent, BookingStatus, EventType, CollectType } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { nightsBetween } from "@/lib/dates";
import { parseOtaAmount, parseOtaDate } from "@/adapters/common/parse-utils";

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
    const isYcs =
      (joined.includes("booking id") || joined.includes("reference id")) &&
      (joined.includes("check-in") ||
        joined.includes("total inclusive rate") ||
        joined.includes("customer"));
    const isHomes =
      joined.includes("bookingid") &&
      (joined.includes("checkindate") ||
        joined.includes("roomtypename") ||
        joined.includes("guestname") ||
        joined.includes("paymentmodel"));

    if (isYcs || isHomes) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      events: [],
      errors: ["Header ekspor reservasi Agoda (YCS atau Partner Portal) tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const isHomes = header.some((h) => h.includes("bookingid") || h.includes("checkindate"));

  const colIndex = {
    bookingId: header.findIndex(
      (h) =>
        h.includes("booking id") ||
        h.includes("reference id") ||
        h.includes("booking no") ||
        h === "bookingid" ||
        h.includes("bookingid"),
    ),
    guest: header.findIndex(
      (h) =>
        h.includes("customer") ||
        h.includes("guest") ||
        h.includes("lead guest") ||
        h === "guestname" ||
        h.includes("guestname"),
    ),
    room: header.findIndex(
      (h) =>
        h.includes("room type") ||
        h.includes("room") ||
        h.includes("rate plan") ||
        h === "roomtypename" ||
        h.includes("roomtypename"),
    ),
    checkIn: header.findIndex(
      (h) =>
        h.includes("check-in") ||
        h.includes("checkin") ||
        h.includes("arrival") ||
        h === "checkindate" ||
        h.includes("checkindate"),
    ),
    checkOut: header.findIndex(
      (h) =>
        h.includes("check-out") ||
        h.includes("checkout") ||
        h.includes("departure") ||
        h === "checkoutdate" ||
        h.includes("checkoutdate"),
    ),
    total: header.findIndex(
      (h) =>
        h.includes("total inclusive") ||
        h.includes("total amount") ||
        h.includes("total rate") ||
        h.includes("inclusive rate") ||
        h === "total" ||
        h === "amount",
    ),
    commission: header.findIndex((h) => h.includes("commission") || h.includes("komisi")),
    status: header.findIndex((h) => h === "status" || h.includes("status")),
    payment: header.findIndex(
      (h) =>
        h.includes("payment model") ||
        h.includes("payment") ||
        h === "paymentmodel" ||
        h.includes("paymentmodel") ||
        h.includes("channel collect"),
    ),
    currency: header.findIndex((h) => h.includes("currency") || h.includes("mata uang")),
    adults: header.findIndex((h) => h === "adults" || h.includes("adult")),
    children: header.findIndex((h) => h === "children" || h.includes("child")),
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

    const preferredPattern = isHomes ? "MM/DD/YYYY" : "AUTO";
    const checkIn = parseOtaDate(checkInRaw, preferredPattern);
    const checkOut = parseOtaDate(checkOutRaw, preferredPattern);

    if (!checkIn || !checkOut) {
      errors.push(
        `Baris ${r + 1}: Tanggal check-in/out Agoda tidak valid (${checkInRaw} / ${checkOutRaw})`,
      );
      continue;
    }

    const nights = Math.max(1, nightsBetween(checkIn, checkOut));
    const guestName = colIndex.guest >= 0 ? row[colIndex.guest]?.trim() : undefined;

    let listingName = "Hillside Eden (Agoda)";
    let externalListingId: string | undefined;

    if (colIndex.room >= 0 && row[colIndex.room]?.trim()) {
      const rawRoom = row[colIndex.room]!.trim();
      listingName = rawRoom;
      // Ekstrak ID dalam tanda kurung bila ada, misal: "Rumah (1388437228)"
      const match = rawRoom.match(/^(.*?)\s*\(([0-9]+)\)$/);
      if (match) {
        externalListingId = match[2];
      }
    }

    const grossAmount = parseOtaAmount(colIndex.total >= 0 ? row[colIndex.total] : undefined);

    const commissionAmount =
      colIndex.commission >= 0 && row[colIndex.commission]?.trim()
        ? parseOtaAmount(row[colIndex.commission])
        : undefined;

    const rawPayment = (colIndex.payment >= 0 ? (row[colIndex.payment] ?? "") : "").toUpperCase();
    let collectType: CollectType = "CHANNEL_COLLECT";
    if (
      rawPayment.includes("HOTEL") ||
      rawPayment.includes("PROPERTY") ||
      rawPayment.includes("BAYAR DI PROPERTI")
    ) {
      collectType = "HOTEL_COLLECT";
    }

    const currency =
      colIndex.currency >= 0 && row[colIndex.currency]?.trim()
        ? row[colIndex.currency]!.trim().toUpperCase()
        : "IDR";

    let guestsCount: number | undefined;
    const adults = colIndex.adults >= 0 ? parseInt(row[colIndex.adults] || "0", 10) : 0;
    const children = colIndex.children >= 0 ? parseInt(row[colIndex.children] || "0", 10) : 0;
    if (adults > 0 || children > 0) {
      guestsCount = adults + children;
    }

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
        externalListingId,
        listingName,
        status,
        checkIn,
        checkOut,
        nights,
        guestsCount,
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
