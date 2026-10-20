/**
 * Skema Validasi Zod untuk Kontrak Adapter Ingest.
 * Sumber kebenaran: docs/06 §2, docs/03 §3.1 (parse -> validasi Zod).
 */

import { z } from "zod";
import { isStayDate, type StayDate } from "../lib/dates";
import {
  BOOKING_STATUSES,
  COLLECT_TYPES,
  CONFIDENCE_LEVELS,
  EVENT_TYPES,
  SUPPORTED_CHANNELS,
  type NormalizedBooking,
  type ParsedBookingEvent,
  type ParsedPayout,
} from "./types";

/** Pola string tanggal YYYY-MM-DD */
const stayDateSchema = z.string().refine((val): val is StayDate => isStayDate(val), {
  message: "Harus berupa format tanggal YYYY-MM-DD yang valid (WITA)",
});

/** Pola angka desimal non-negatif dalam bentuk string */
const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Harus berupa format angka desimal non-negatif");

export const channelCodeSchema = z.enum(SUPPORTED_CHANNELS);
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const eventTypeSchema = z.enum(EVENT_TYPES);
export const collectTypeSchema = z.enum(COLLECT_TYPES);
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);

/**
 * Skema Zod untuk validasi NormalizedBooking.
 */
export const normalizedBookingSchema = z
  .object({
    channel: channelCodeSchema,
    externalId: z.string().trim().min(1, "externalId (kode konfirmasi OTA) wajib diisi"),
    externalListingId: z.string().trim().optional(),
    listingName: z.string().trim().optional(),
    status: bookingStatusSchema,
    bookedAt: z.date().optional(),
    checkIn: stayDateSchema,
    checkOut: stayDateSchema,
    nights: z.number().int().positive().optional(),
    guestsCount: z.number().int().positive().optional(),
    guestName: z.string().trim().optional(),
    countryCode: z.string().trim().length(2).toUpperCase().optional(),
    currency: z.string().trim().min(3).max(3).toUpperCase(),
    grossAmount: decimalStringSchema.optional(),
    taxesCollected: decimalStringSchema.optional(),
    cancellationFee: decimalStringSchema.optional(),
    commissionAmount: decimalStringSchema.optional(),
    commissionRate: z
      .string()
      .regex(/^0(\.\d+)?$|^1(\.0+)?$/, "commissionRate harus di antara 0 dan 1")
      .optional(),
    collectType: collectTypeSchema.optional(),
    payoutAmount: decimalStringSchema.optional(),
    payoutDate: stayDateSchema.optional(),
    rawPayload: z.record(z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    // 1. Tanggal checkout harus setelah checkin
    if (val.checkIn && val.checkOut && val.checkOut <= val.checkIn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkOut"],
        message: `checkOut (${val.checkOut}) harus lebih besar dari checkIn (${val.checkIn})`,
      });
    }

    // 2. Booking CONFIRMED / PENDING wajib menyertakan grossAmount (docs/06 §2)
    if ((val.status === "CONFIRMED" || val.status === "PENDING") && !val.grossAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grossAmount"],
        message: `grossAmount wajib ada untuk booking berstatus ${val.status}`,
      });
    }
  });

/**
 * Skema Zod untuk ParsedBookingEvent.
 */
export const parsedBookingEventSchema = z.object({
  eventType: eventTypeSchema,
  occurredAt: z.date(),
  booking: normalizedBookingSchema,
  confidence: confidenceLevelSchema,
  warnings: z.array(z.string()),
});

/**
 * Skema Zod untuk ParsedPayout.
 */
export const parsedPayoutSchema = z.object({
  channel: channelCodeSchema,
  reference: z.string().trim().min(1, "reference payout wajib diisi"),
  payoutDate: z.union([z.date(), stayDateSchema]),
  amount: decimalStringSchema,
  currency: z.string().trim().min(3).max(3).toUpperCase(),
  bookingExternalIds: z.array(z.string()),
  rawPayload: z.record(z.unknown()).optional(),
});

/**
 * Fungsi pembantu validasi: melempar error bila data tidak valid.
 */
export function validateNormalizedBooking(data: unknown): NormalizedBooking {
  return normalizedBookingSchema.parse(data) as NormalizedBooking;
}

/**
 * Fungsi pembantu validasi aman (SafeParse).
 */
export function safeValidateNormalizedBooking(data: unknown) {
  return normalizedBookingSchema.safeParse(data);
}

/**
 * Validasi event booking.
 */
export function validateParsedBookingEvent(data: unknown): ParsedBookingEvent {
  return parsedBookingEventSchema.parse(data) as ParsedBookingEvent;
}

/**
 * Validasi payout yang diparsing.
 */
export function validateParsedPayout(data: unknown): ParsedPayout {
  return parsedPayoutSchema.parse(data) as ParsedPayout;
}
