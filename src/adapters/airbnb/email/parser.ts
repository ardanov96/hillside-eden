/**
 * Parser email notifikasi Airbnb deterministik (S5-03).
 *
 * Mendukung email reservasi baru (confirmed), perubahan tanggal (altered),
 * dan pembatalan (cancelled).
 */
import type { ParsedBookingEvent, BookingStatus, EventType } from "@/adapters/types";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

export interface AirbnbEmailRaw {
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export function parseAirbnbEmail(input: AirbnbEmailRaw): {
  event?: ParsedBookingEvent;
  error?: string;
} {
  const content = (input.text || input.html || "").trim();
  const subject = input.subject || "";

  // 1. Tentukan Event Type & Booking Status dari Subject
  const lowerSub = subject.toLowerCase();
  let eventType: EventType = "CREATED";
  let status: BookingStatus = "CONFIRMED";

  if (lowerSub.includes("cancel") || lowerSub.includes("batal")) {
    eventType = "CANCELLED";
    status = "CANCELLED";
  } else if (
    lowerSub.includes("alter") ||
    lowerSub.includes("ubah") ||
    lowerSub.includes("update")
  ) {
    eventType = "MODIFIED";
    status = "CONFIRMED";
  } else if (lowerSub.includes("confirm") || lowerSub.includes("konfirmasi")) {
    eventType = "CREATED";
    status = "CONFIRMED";
  }

  // 2. Ekstraksi Confirmation Code
  // Pola Airbnb: HM diikuti 8 karakter alfanumerik atau kata 'Confirmation code: XYZ'
  let externalId: string | undefined;
  const codeMatch =
    content.match(/Confirmation code:\s*([A-Za-z0-9]+)/i) ||
    content.match(/Kode konfirmasi:\s*([A-Za-z0-9]+)/i) ||
    subject.match(/\b(HM[A-Z0-9]{8})\b/i);

  if (codeMatch && codeMatch[1]) {
    externalId = codeMatch[1].trim().toUpperCase();
  }

  if (!externalId) {
    return { error: "Kode konfirmasi reservasi Airbnb tidak ditemukan dalam email" };
  }

  // 3. Ekstraksi Tanggal Check-in & Check-out
  let checkIn: StayDate | undefined;
  let checkOut: StayDate | undefined;

  const checkInMatch =
    content.match(/Check-in:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Masuk:\s*(\d{4}-\d{2}-\d{2})/i);
  const checkOutMatch =
    content.match(/Check-out:\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Keluar:\s*(\d{4}-\d{2}-\d{2})/i);

  const rawIn = checkInMatch?.[1];
  if (rawIn && isStayDate(rawIn)) {
    checkIn = rawIn as StayDate;
  }
  const rawOut = checkOutMatch?.[1];
  if (rawOut && isStayDate(rawOut)) {
    checkOut = rawOut as StayDate;
  }

  if (!checkIn || !checkOut) {
    return { error: `Tanggal check-in atau check-out tidak ditemukan dalam email ${externalId}` };
  }

  // 4. Ekstraksi Guest Name & Listing
  const guestMatch = content.match(/Guest:\s*([^\n\r]+)/i) || content.match(/Tamu:\s*([^\n\r]+)/i);
  const guestName = guestMatch?.[1] ? guestMatch[1].trim() : undefined;

  const listingMatch =
    content.match(/Listing:\s*([^\n\r]+)/i) || content.match(/Properti:\s*([^\n\r]+)/i);
  const listingName = listingMatch?.[1] ? listingMatch[1].trim() : undefined;

  // 5. Ekstraksi Nilai Finansial
  let grossAmount = "0.00";
  let currency = "IDR";
  const payoutMatch =
    content.match(/Total payout:\s*([A-Z]{3})?\s*([0-9.,]+)/i) ||
    content.match(/Total:\s*([A-Z]{3})?\s*([0-9.,]+)/i);

  if (payoutMatch) {
    if (payoutMatch[1]) currency = payoutMatch[1].toUpperCase();
    const rawNum = (payoutMatch[2] ?? "").replace(/,/g, "");
    grossAmount = Number.parseFloat(rawNum || "0").toFixed(2);
  }

  const nights = nightsBetween(checkIn, checkOut);

  return {
    event: {
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
    },
  };
}
