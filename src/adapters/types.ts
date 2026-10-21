/**
 * Kontrak Adapter dan Tipe Data Ingest Hillside Eden.
 * Sumber kebenaran: docs/06-ingestion-and-adapters.md §2, docs/03-architecture.md §3.1,
 * docs/04-data-model.md model Booking, BookingEvent, Payout.
 *
 * Prinsip:
 * - Adapter bersifat MURNI dan DETERMINISTIK (input sama -> keluaran sama, tanpa I/O atau DB).
 * - Menambah sumber OTA baru = mengimplementasikan `SourceAdapter` tanpa mengubah dashboard.
 */

import { type StayDate } from "../lib/dates";

export const SUPPORTED_CHANNELS = [
  "AIRBNB",
  "TIKET_COM",
  "TRAVELOKA",
  "EXPEDIA",
  "AGODA",
  "BOOKING_COM",
  "DIRECT",
  "MANUAL",
] as const;

export type ChannelCode = (typeof SUPPORTED_CHANNELS)[number];

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EVENT_TYPES = ["CREATED", "MODIFIED", "CANCELLED", "NO_SHOW"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const COLLECT_TYPES = ["CHANNEL_COLLECT", "HOTEL_COLLECT", "UNKNOWN"] as const;

export type CollectType = (typeof COLLECT_TYPES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export type ParseErrorCode =
  "UNSUPPORTED_FORMAT" | "MISSING_FIELD" | "INVALID_VALUE" | "AMBIGUOUS" | "UNKNOWN";

/**
 * Representasi masukan mentah sebelum diproses oleh adapter (docs/06 §2).
 */
export type RawInput =
  | {
      kind: "email";
      receivedAt: Date;
      from: string;
      subject: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
      storageKey?: string;
    }
  | {
      kind: "csv";
      filename: string;
      content: Buffer | string;
      mappingProfileId?: string;
    }
  | {
      kind: "ical";
      listingId: string;
      content: string;
    }
  | {
      kind: "manual";
      payload: unknown;
    };

/**
 * Entitas booking ternormalisasi hasil parsing adapter.
 * Angka keuangan disimpan sebagai string Decimal berpresisi untuk mencegah precision loss (docs/06 §2).
 */
export interface NormalizedBooking {
  channel: ChannelCode;
  externalId: string; // kode konfirmasi OTA
  externalListingId?: string;
  listingName?: string;
  status: BookingStatus;
  bookedAt?: Date; // waktu pemesanan (bila null, pipeline memakai waktu diterima + tanda approx)
  checkIn: StayDate; // 'YYYY-MM-DD' (zona waktu WITA)
  checkOut: StayDate; // 'YYYY-MM-DD'
  nights?: number;
  guestsCount?: number;
  guestName?: string; // nama tampilan/inisial sesuai kebijakan PII minimal (OD-06)
  countryCode?: string;
  currency: string;
  grossAmount?: string; // Decimal string, wajib untuk non-pembatalan
  taxesCollected?: string;
  cancellationFee?: string; // diakui sebagai revenue pada check-in semula (docs/05 §4)
  commissionAmount?: string;
  commissionRate?: string;
  collectType?: CollectType;
  payoutAmount?: string;
  payoutDate?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * Event perubahan status booking yang dihasilkan parser.
 */
export interface ParsedBookingEvent {
  eventType: EventType;
  /**
   * Waktu event terjadi secara faktual (waktu pemesanan dari sumber).
   *
   * WAJIB opsional agar adapter tetap deterministik (AGENTS.md aturan 3):
   * adapter tidak boleh injecting `new Date()` karena dua parse atas input
   * identik akan menghasilkan output berbeda. Bila sumber tidak menyediakan
   * waktu, biarkan undefined; pipeline akan mengisi dengan waktu penerimaan
   * (satu cap waktu per batch) dan menandai `bookedAtIsApprox` di payload.
   */
  occurredAt?: Date;
  booking: NormalizedBooking;
  confidence: ConfidenceLevel;
  warnings: string[];
}

/**
 * Payout/laporan pembayaran yang diekstraksi dari sumber (mis. laporan Airbnb).
 */
export interface ParsedPayout {
  channel: ChannelCode;
  reference: string;
  payoutDate: Date | StayDate;
  amount: string;
  currency: string;
  bookingExternalIds: string[];
  rawPayload?: Record<string, unknown>;
}

/**
 * Hasil keluaran parser adapter.
 */
export type ParseResult =
  | {
      ok: true;
      events: ParsedBookingEvent[];
      payouts?: ParsedPayout[];
    }
  | {
      ok: false;
      errorCode: ParseErrorCode;
      message: string;
      details?: unknown;
    };

/**
 * Kontrak antarmuka adapter sumber OTA (docs/06 §2).
 */
export interface SourceAdapter {
  readonly id: string; // mis. 'airbnb.email.v1', 'tiket.csv.v1'
  readonly channel: ChannelCode;
  supports(input: RawInput): boolean; // Cepat & tanpa efek samping
  parse(input: RawInput): Promise<ParseResult> | ParseResult;
}
