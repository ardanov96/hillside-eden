/**
 * Parser Email Notifikasi Traveloka (S6-03).
 */
import type { ParsedBookingEvent, BookingStatus, EventType } from "@/adapters/types";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export interface TravelokaEmailRaw {
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function parseTravelokaEmail(input: TravelokaEmailRaw): {
  event?: ParsedBookingEvent;
  error?: string;
} {
  const content = (input.text || input.html || "").trim();
  const subject = input.subject || "";

  // 1. Tentukan Event Type & Status
  const lowerSub = subject.toLowerCase();
  let eventType: EventType = "CREATED";
  let status: BookingStatus = "CONFIRMED";

  if (lowerSub.includes("batal") || lowerSub.includes("cancel")) {
    eventType = "CANCELLED";
    status = "CANCELLED";
  } else if (
    lowerSub.includes("ubah") ||
    lowerSub.includes("reschedule") ||
    lowerSub.includes("perubahan")
  ) {
    eventType = "MODIFIED";
    status = "CONFIRMED";
  }

  // 2. Ekstraksi Booking ID
  let externalId: string | undefined;
  const idMatch =
    content.match(/Booking ID:\s*([A-Za-z0-9-]+)/i) ||
    content.match(/No\.?\s*Pemesanan:\s*([A-Za-z0-9-]+)/i) ||
    subject.match(/Voucher\s*-\s*([A-Za-z0-9-]+)/i) ||
    subject.match(/Traveloka\s*-\s*([A-Za-z0-9-]+)/i);

  if (idMatch && idMatch[1]) {
    externalId = idMatch[1].trim().toUpperCase();
  }

  if (!externalId) {
    return { error: "Booking ID Traveloka tidak ditemukan dalam email" };
  }

  // 3. Ekstraksi Tanggal Check-in & Check-out
  let checkIn: StayDate | undefined;
  let checkOut: StayDate | undefined;

  const inMatch =
    content.match(/Check-in:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Tanggal Check-in:\s*(\d{4}-\d{2}-\d{2})/i);
  const outMatch =
    content.match(/Check-out:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Tanggal Check-out:\s*(\d{4}-\d{2}-\d{2})/i);

  const rawIn = inMatch?.[1];
  if (rawIn && isStayDate(rawIn)) {
    checkIn = rawIn as StayDate;
  }
  const rawOut = outMatch?.[1];
  if (rawOut && isStayDate(rawOut)) {
    checkOut = rawOut as StayDate;
  }

  if (!checkIn || !checkOut) {
    return { error: `Tanggal check-in atau check-out tidak ditemukan dalam email ${externalId}` };
  }

  // 4. Ekstraksi Nama Tamu & Properti
  const guestMatch =
    content.match(/Nama Tamu:\s*([^\n\r]+)/i) || content.match(/Guest Name:\s*([^\n\r]+)/i);
  const guestName = guestMatch?.[1] ? guestMatch[1].trim() : undefined;

  const propMatch =
    content.match(/Properti:\s*([^\n\r]+)/i) || content.match(/Hotel:\s*([^\n\r]+)/i);
  const listingName = propMatch?.[1]
    ? propMatch[1].trim()
    : "Hillside Eden Bali - Estate (Traveloka)";

  // 5. Ekstraksi Nominal
  let grossAmount = "0.00";
  let currency = "IDR";
  const payMatch =
    content.match(/Tarif Total:\s*([A-Z]{3})?\s*([0-9.,]+)/i) ||
    content.match(/Total:\s*([A-Z]{3})?\s*([0-9.,]+)/i);

  if (payMatch) {
    if (payMatch[1]) currency = payMatch[1].toUpperCase();
    const rawNum = (payMatch[2] ?? "").replace(/,/g, "");
    grossAmount = Number.parseFloat(rawNum || "0").toFixed(2);
  }

  const nights = nightsBetween(checkIn, checkOut);

  return {
    event: {
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
        collectType: "CHANNEL_COLLECT",
      },
    },
  };
}
