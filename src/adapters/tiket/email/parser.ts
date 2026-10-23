/**
 * Parser Email Notifikasi Tiket.com (S6-02).
 */
import type { ParsedBookingEvent, BookingStatus, EventType } from "@/adapters/types";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export interface TiketEmailRaw {
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function parseTiketEmail(input: TiketEmailRaw): {
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
    lowerSub.includes("modifi")
  ) {
    eventType = "MODIFIED";
    status = "CONFIRMED";
  }

  // 2. Ekstraksi Order ID
  let externalId: string | undefined;
  const orderMatch =
    content.match(/Order ID:\s*([A-Za-z0-9-]+)/i) ||
    content.match(/No\.?\s*Pesanan:\s*([A-Za-z0-9-]+)/i) ||
    subject.match(/Order ID\s+([A-Za-z0-9-]+)/i);

  if (orderMatch && orderMatch[1]) {
    externalId = orderMatch[1].trim().toUpperCase();
  }

  if (!externalId) {
    return { error: "Order ID Tiket.com tidak ditemukan dalam email" };
  }

  // 3. Ekstraksi Tanggal Check-in & Check-out
  let checkIn: StayDate | undefined;
  let checkOut: StayDate | undefined;

  const inMatch =
    content.match(/Check[ -]?In:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Masuk:\s*(\d{4}-\d{2}-\d{2})/i);
  const outMatch =
    content.match(/Check[ -]?Out:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Keluar:\s*(\d{4}-\d{2}-\d{2})/i);

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
    : "Hillside Eden Bali - Estate (Tiket.com)";

  // 5. Ekstraksi Nominal
  let grossAmount = "0.00";
  let currency = "IDR";
  const payMatch =
    content.match(/Total Pembayaran:\s*([A-Z]{3})?\s*([0-9.,]+)/i) ||
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
        collectType: "CHANNEL_COLLECT",
      },
    },
  };
}
