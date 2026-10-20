/**
 * Profil Pemetaan Impor CSV Generik (ImportMappingProfile).
 * Sumber kebenaran: docs/06-ingestion-and-adapters.md §7, docs/04-data-model.md model ImportMappingProfile.
 */

import { z } from "zod";
import { bookingStatusSchema, channelCodeSchema, collectTypeSchema } from "../schema";
import { type BookingStatus, type ChannelCode, type CollectType } from "../types";

export const NUMBER_LOCALES = ["id-ID", "en-US"] as const;
export type NumberLocale = (typeof NUMBER_LOCALES)[number];

export const DATE_FORMAT_PATTERNS = [
  "AUTO",
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "DD-MM-YYYY",
  "D MMM YYYY",
  "MM/DD/YYYY",
] as const;
export type DateFormatPattern = (typeof DATE_FORMAT_PATTERNS)[number];

export interface CsvColumnMapping {
  externalId: string; // nama kolom untuk kode konfirmasi OTA
  externalListingId?: string;
  listingName?: string;
  status?: string;
  checkIn: string;
  checkOut: string;
  bookedAt?: string;
  currency?: string;
  grossAmount?: string;
  taxesCollected?: string;
  cancellationFee?: string;
  commissionAmount?: string;
  commissionRate?: string;
  guestName?: string;
  countryCode?: string;
  collectType?: string;
}

export interface CsvMappingProfile {
  id?: string;
  name: string;
  channel?: ChannelCode;
  delimiter?: string; // default ","
  headerRow?: number; // 1-indexed, default 1
  numberLocale: NumberLocale; // "id-ID" (1.500.000,00) atau "en-US" (1,500,000.00)
  dateFormat?: DateFormatPattern; // default "AUTO"
  defaultCurrency?: string; // default "IDR"
  defaultStatus?: BookingStatus; // default "CONFIRMED"
  defaultCollectType?: CollectType; // default "UNKNOWN"
  statusMapping?: Record<string, BookingStatus>;
  columns: CsvColumnMapping;
}

export const csvColumnMappingSchema = z.object({
  externalId: z.string().min(1, "Kolom externalId wajib dipetakan"),
  externalListingId: z.string().optional(),
  listingName: z.string().optional(),
  status: z.string().optional(),
  checkIn: z.string().min(1, "Kolom checkIn wajib dipetakan"),
  checkOut: z.string().min(1, "Kolom checkOut wajib dipetakan"),
  bookedAt: z.string().optional(),
  currency: z.string().optional(),
  grossAmount: z.string().optional(),
  taxesCollected: z.string().optional(),
  cancellationFee: z.string().optional(),
  commissionAmount: z.string().optional(),
  commissionRate: z.string().optional(),
  guestName: z.string().optional(),
  countryCode: z.string().optional(),
  collectType: z.string().optional(),
});

export const csvMappingProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nama profil pemetaan wajib diisi"),
  channel: channelCodeSchema.optional(),
  delimiter: z.string().min(1).max(2).default(","),
  headerRow: z.number().int().min(1).default(1),
  numberLocale: z.enum(NUMBER_LOCALES),
  dateFormat: z.enum(DATE_FORMAT_PATTERNS).default("AUTO"),
  defaultCurrency: z.string().default("IDR"),
  defaultStatus: bookingStatusSchema.default("CONFIRMED"),
  defaultCollectType: collectTypeSchema.default("UNKNOWN"),
  statusMapping: z.record(bookingStatusSchema).optional(),
  columns: csvColumnMappingSchema,
});
