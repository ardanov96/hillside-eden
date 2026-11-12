/**
 * Parser Direct Booking Webhook (hillsideedenubud.com).
 *
 * Menerima payload webhook dari website resmi (WordPress MotoPress Hotel Booking,
 * WooCommerce order, atau format JSON direct booking standar).
 * Menghasilkan NormalizedBooking dan ParsedBookingEvent yang deterministik dan tervalidasi.
 */

import { parseOtaAmount } from "@/adapters/common/parse-utils";
import { tryParseLocalizedDate } from "@/adapters/csv-generic/date-parser";
import { safeValidateNormalizedBooking } from "@/adapters/schema";
import {
  type BookingStatus,
  type CollectType,
  type EventType,
  type NormalizedBooking,
  type ParsedBookingEvent,
  type ParseResult,
} from "@/adapters/types";
import { isStayDate, nightsBetween, type StayDate } from "@/lib/dates";

/**
 * Ekstraksi nilai string dari berbagai kemungkinan key pada payload.
 */
function findString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "string" && val.trim() !== "") {
      return val.trim();
    }
    if (typeof val === "number") {
      return String(val);
    }
  }
  return undefined;
}

/**
 * Ekstraksi value dari meta_data array (standar WooCommerce / MotoPress WP REST).
 */
function findMetaValue(metaArray: unknown, key: string): string | undefined {
  if (!Array.isArray(metaArray)) return undefined;
  for (const item of metaArray) {
    if (item && typeof item === "object" && "key" in item && "value" in item) {
      if ((item as { key: string }).key === key) {
        const val = (item as { value: unknown }).value;
        if (typeof val === "string") return val.trim();
        if (typeof val === "number") return String(val);
      }
    }
  }
  return undefined;
}

/**
 * Normalisasi status pemesanan ke enum BookingStatus.
 */
export function normalizeDirectBookingStatus(rawStatus: string | undefined): BookingStatus {
  if (!rawStatus) return "CONFIRMED";
  const s = rawStatus.toLowerCase().trim();

  switch (s) {
    case "confirmed":
    case "completed":
    case "complete":
    case "paid":
    case "approved":
    case "success":
    case "publish":
      return "CONFIRMED";

    case "pending":
    case "on-hold":
    case "processing":
    case "unpaid":
    case "draft":
    case "auto-draft":
      return "PENDING";

    case "cancelled":
    case "canceled":
    case "refunded":
    case "failed":
    case "trash":
      return "CANCELLED";

    case "no_show":
    case "no-show":
    case "noshow":
      return "NO_SHOW";

    default:
      return "CONFIRMED";
  }
}

/**
 * Normalisasi tanggal menginap ke format StayDate (YYYY-MM-DD).
 */
function parseDateToStayDate(raw: unknown): StayDate | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (isStayDate(s)) return s;
    const parsed = tryParseLocalizedDate(s);
    if (parsed) return parsed;
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  return undefined;
}

/**
 * Ekstraksi tanggal check-in & check-out dari berbagai format payload webhook.
 */
function extractStayDates(payload: Record<string, unknown>): {
  checkIn?: StayDate;
  checkOut?: StayDate;
} {
  // 1. Direct keys
  let checkInRaw = findString(payload, [
    "checkIn",
    "check_in",
    "check_in_date",
    "checkin",
    "arrival",
    "start_date",
  ]);
  let checkOutRaw = findString(payload, [
    "checkOut",
    "check_out",
    "check_out_date",
    "checkout",
    "departure",
    "end_date",
  ]);

  // 2. Meta data fallback (WooCommerce / MotoPress)
  if (!checkInRaw && payload.meta_data) {
    checkInRaw =
      findMetaValue(payload.meta_data, "mphb_check_in_date") ||
      findMetaValue(payload.meta_data, "_mphb_check_in_date") ||
      findMetaValue(payload.meta_data, "check_in_date");
  }
  if (!checkOutRaw && payload.meta_data) {
    checkOutRaw =
      findMetaValue(payload.meta_data, "mphb_check_out_date") ||
      findMetaValue(payload.meta_data, "_mphb_check_out_date") ||
      findMetaValue(payload.meta_data, "check_out_date");
  }

  // 3. Nested booking object (MotoPress REST structure)
  if ((!checkInRaw || !checkOutRaw) && payload.booking && typeof payload.booking === "object") {
    const nested = payload.booking as Record<string, unknown>;
    checkInRaw = checkInRaw || findString(nested, ["check_in_date", "checkIn"]);
    checkOutRaw = checkOutRaw || findString(nested, ["check_out_date", "checkOut"]);
  }

  return {
    checkIn: parseDateToStayDate(checkInRaw),
    checkOut: parseDateToStayDate(checkOutRaw),
  };
}

/**
 * Ekstraksi nama tamu dari payload.
 */
function extractGuestName(payload: Record<string, unknown>): string | undefined {
  const directName = findString(payload, ["guestName", "guest_name", "customer_name", "name"]);
  if (directName) return directName;

  // Objek customer / billing
  const customer = (payload.customer || payload.billing || payload.guest) as
    Record<string, unknown> | undefined;

  if (customer && typeof customer === "object") {
    const first = findString(customer, ["first_name", "firstName", "name"]) || "";
    const last = findString(customer, ["last_name", "lastName"]) || "";
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
  }

  return undefined;
}

/**
 * Parser utama Direct Booking Webhook.
 */
export function parseDirectWebhookPayload(rawPayload: unknown): ParseResult {
  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_FORMAT",
      message: "Payload webhook harus berupa JSON object",
    };
  }

  const payload = rawPayload as Record<string, unknown>;

  // 1. External ID (Kode Reservasi / Order ID)
  const externalId =
    findString(payload, [
      "externalId",
      "bookingId",
      "booking_id",
      "id",
      "order_id",
      "order_number",
      "code",
      "reference",
    ]) ||
    (payload.booking && typeof payload.booking === "object"
      ? findString(payload.booking as Record<string, unknown>, ["id", "booking_id"])
      : undefined);

  if (!externalId) {
    return {
      ok: false,
      errorCode: "MISSING_FIELD",
      message: "externalId / bookingId tidak ditemukan pada payload webhook",
    };
  }

  // 2. Status
  const rawStatus =
    findString(payload, ["status", "booking_status", "order_status", "post_status"]) ||
    (payload.booking && typeof payload.booking === "object"
      ? findString(payload.booking as Record<string, unknown>, ["status"])
      : undefined);
  const status = normalizeDirectBookingStatus(rawStatus);

  // 3. Tanggal Menginap
  const { checkIn, checkOut } = extractStayDates(payload);
  if (!checkIn) {
    return {
      ok: false,
      errorCode: "MISSING_FIELD",
      message: "Tanggal checkIn tidak valid atau tidak ditemukan pada payload",
    };
  }
  if (!checkOut) {
    return {
      ok: false,
      errorCode: "MISSING_FIELD",
      message: "Tanggal checkOut tidak valid atau tidak ditemukan pada payload",
    };
  }
  if (checkOut <= checkIn) {
    return {
      ok: false,
      errorCode: "INVALID_VALUE",
      message: `Tanggal checkOut (${checkOut}) harus lebih besar dari checkIn (${checkIn})`,
    };
  }

  const nights = nightsBetween(checkIn, checkOut);

  // 4. Finansial
  const currency = (findString(payload, ["currency", "order_currency"]) || "IDR").toUpperCase();

  const rawGross =
    findString(payload, [
      "grossAmount",
      "total",
      "total_price",
      "amount",
      "order_total",
      "price",
    ]) ||
    (payload.booking && typeof payload.booking === "object"
      ? findString(payload.booking as Record<string, unknown>, ["total_price", "total"])
      : undefined);

  let grossAmount: string | undefined;
  let cancellationFee: string | undefined;

  if (status === "CANCELLED") {
    const rawCancelFee = findString(payload, ["cancellationFee", "cancellation_fee", "penalty"]);
    cancellationFee = rawCancelFee ? parseOtaAmount(rawCancelFee) : "0.00";
    if (rawGross) {
      grossAmount = parseOtaAmount(rawGross);
    }
  } else {
    grossAmount =
      rawGross !== undefined && rawGross.trim() !== "" ? parseOtaAmount(rawGross) : undefined;
  }

  // Komisi Direct Booking selalu 0.00 (bebas komisi OTA)
  const commissionAmount = "0.00";
  const commissionRate = "0";

  // Collect Type: default CHANNEL_COLLECT bila dibayar via web, HOTEL_COLLECT bila tunai/transfer di hotel
  const paymentMethod = (
    findString(payload, ["paymentMethod", "payment_method", "payment_method_title"]) || ""
  ).toLowerCase();

  let collectType: CollectType = "CHANNEL_COLLECT";
  if (
    paymentMethod.includes("hotel") ||
    paymentMethod.includes("arrival") ||
    paymentMethod.includes("cash") ||
    paymentMethod.includes("cod")
  ) {
    collectType = "HOTEL_COLLECT";
  }

  // 5. Tamu & Occupancy
  const guestName = extractGuestName(payload);
  const rawGuestsCount =
    findString(payload, ["guestsCount", "guests", "adults", "total_guests", "guest_count"]) || "1";
  const parsedGuests = parseInt(rawGuestsCount, 10);
  const guestsCount = Number.isInteger(parsedGuests) && parsedGuests > 0 ? parsedGuests : 1;

  // 6. Tanggal Booked
  const rawBookedAt = findString(payload, [
    "bookedAt",
    "created_at",
    "date_created",
    "booking_date",
    "post_date",
  ]);
  let bookedAt: Date | undefined;
  if (rawBookedAt) {
    const parsed = new Date(rawBookedAt);
    if (!isNaN(parsed.getTime())) {
      bookedAt = parsed;
    }
  }

  // 7. Listing target
  const externalListingId =
    findString(payload, ["listingId", "listing_id", "externalListingId"]) || "he-direct-website";
  const listingName =
    findString(payload, ["listingName", "listing_name"]) || "Hillside Eden Ubud - Direct Website";

  // 8. Bentuk NormalizedBooking
  const normalized: NormalizedBooking = {
    channel: "DIRECT",
    externalId: String(externalId),
    externalListingId,
    listingName,
    status,
    bookedAt,
    checkIn,
    checkOut,
    nights,
    guestsCount,
    guestName,
    currency,
    grossAmount,
    cancellationFee,
    commissionAmount,
    commissionRate,
    collectType,
    rawPayload: payload,
  };

  // Validasi Zod NormalizedBooking
  const validation = safeValidateNormalizedBooking(normalized);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return {
      ok: false,
      errorCode: "INVALID_VALUE",
      message: issue?.message || "Validasi NormalizedBooking gagal",
      details: validation.error.issues,
    };
  }

  // 9. Tentukan EventType
  let eventType: EventType = "CREATED";
  if (status === "CANCELLED") {
    eventType = "CANCELLED";
  } else if (status === "NO_SHOW") {
    eventType = "NO_SHOW";
  } else {
    const action = (findString(payload, ["action", "event", "eventType"]) || "").toLowerCase();
    if (action === "update" || action === "modified" || action === "mphb_booking_status_changed") {
      eventType = "MODIFIED";
    }
  }

  const event: ParsedBookingEvent = {
    eventType,
    occurredAt: bookedAt,
    booking: validation.data,
    confidence: "high",
    warnings: [],
  };

  return {
    ok: true,
    events: [event],
  };
}
