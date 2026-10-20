/**
 * Pratinjau Impor CSV Generik (docs/06 §7).
 * Menampilkan 20 baris pertama dengan hasil parsing sebelum konfirmasi impor;
 * baris bermasalah ditandai dengan detail kesalahan per kolom.
 */

import { safeValidateNormalizedBooking } from "../schema";
import type { BookingStatus, CollectType, NormalizedBooking } from "../types";
import { parseCsvRows } from "./csv-tokenizer";
import { parseLocalizedDate } from "./date-parser";
import { parseLocalizedNumber } from "./number-parser";
import type { CsvMappingProfile } from "./profile";

export interface CsvRowPreview {
  rowNumber: number; // 1-indexed baris pada berkas CSV
  raw: Record<string, string>;
  parsed?: NormalizedBooking;
  errors?: string[];
  isValid: boolean;
}

export interface CsvPreviewResult {
  headers: string[];
  totalRows: number;
  previewRows: CsvRowPreview[];
  validCount: number;
  errorCount: number;
}

/**
 * Membaca baris-baris CSV dan memetakan nilai kolom ke NormalizedBooking.
 */
export function mapRowToBooking(
  rawRecord: Record<string, string>,
  profile: CsvMappingProfile,
): { booking?: NormalizedBooking; errors: string[] } {
  const errors: string[] = [];
  const col = profile.columns;

  const getCol = (key?: string): string | undefined => {
    if (!key) return undefined;
    const v = rawRecord[key];
    return v !== undefined && v !== "" ? v : undefined;
  };

  const rawExtId = getCol(col.externalId);
  if (!rawExtId) {
    errors.push(`Kolom "${col.externalId}" (externalId) kosong`);
  }

  const rawCheckIn = getCol(col.checkIn);
  let checkInStr = "";
  if (!rawCheckIn) {
    errors.push(`Kolom "${col.checkIn}" (checkIn) kosong`);
  } else {
    try {
      checkInStr = parseLocalizedDate(rawCheckIn, profile.dateFormat);
    } catch (e) {
      errors.push(`checkIn gagal diurai (${(e as Error).message})`);
    }
  }

  const rawCheckOut = getCol(col.checkOut);
  let checkOutStr = "";
  if (!rawCheckOut) {
    errors.push(`Kolom "${col.checkOut}" (checkOut) kosong`);
  } else {
    try {
      checkOutStr = parseLocalizedDate(rawCheckOut, profile.dateFormat);
    } catch (e) {
      errors.push(`checkOut gagal diurai (${(e as Error).message})`);
    }
  }

  // Status mapping
  let status: BookingStatus = profile.defaultStatus ?? "CONFIRMED";
  const rawStatus = getCol(col.status);
  if (rawStatus) {
    const normalizedRawStatus = rawStatus.toLowerCase();
    if (profile.statusMapping && profile.statusMapping[normalizedRawStatus]) {
      status = profile.statusMapping[normalizedRawStatus]!;
    } else {
      const upper = rawStatus.toUpperCase();
      if (
        upper === "CONFIRMED" ||
        upper === "CANCELLED" ||
        upper === "PENDING" ||
        upper === "NO_SHOW"
      ) {
        status = upper;
      }
    }
  }

  // Gross Amount
  let grossAmountStr: string | undefined;
  const rawGross = getCol(col.grossAmount);
  if (rawGross) {
    try {
      const dec = parseLocalizedNumber(rawGross, profile.numberLocale);
      grossAmountStr = dec.toString();
    } catch (e) {
      errors.push(`grossAmount gagal diurai (${(e as Error).message})`);
    }
  }

  // Taxes
  let taxesStr: string | undefined;
  const rawTaxes = getCol(col.taxesCollected);
  if (rawTaxes) {
    try {
      taxesStr = parseLocalizedNumber(rawTaxes, profile.numberLocale).toString();
    } catch (e) {
      errors.push(`taxesCollected gagal diurai (${(e as Error).message})`);
    }
  }

  // Cancellation fee
  let feeStr: string | undefined;
  const rawFee = getCol(col.cancellationFee);
  if (rawFee) {
    try {
      feeStr = parseLocalizedNumber(rawFee, profile.numberLocale).toString();
    } catch (e) {
      errors.push(`cancellationFee gagal diurai (${(e as Error).message})`);
    }
  }

  // Commission amount
  let commAmountStr: string | undefined;
  const rawCommAmount = getCol(col.commissionAmount);
  if (rawCommAmount) {
    try {
      commAmountStr = parseLocalizedNumber(rawCommAmount, profile.numberLocale).toString();
    } catch (e) {
      errors.push(`commissionAmount gagal diurai (${(e as Error).message})`);
    }
  }

  // Booked at
  let bookedAtDate: Date | undefined;
  const rawBookedAt = getCol(col.bookedAt);
  if (rawBookedAt) {
    try {
      const parsedStay = parseLocalizedDate(rawBookedAt, profile.dateFormat);
      bookedAtDate = new Date(parsedStay + "T00:00:00Z");
    } catch {
      // Tidak fatal, biarkan undefined
    }
  }

  // Collect type
  let collectType: CollectType = profile.defaultCollectType ?? "UNKNOWN";
  const rawCollect = getCol(col.collectType);
  if (rawCollect) {
    const upper = rawCollect.toUpperCase();
    if (upper === "CHANNEL_COLLECT" || upper === "HOTEL_COLLECT") {
      collectType = upper;
    }
  }

  const candidate: Partial<NormalizedBooking> = {
    channel: profile.channel ?? "MANUAL",
    externalId: rawExtId ?? "",
    externalListingId: getCol(col.externalListingId),
    listingName: getCol(col.listingName),
    status,
    checkIn: checkInStr,
    checkOut: checkOutStr,
    bookedAt: bookedAtDate,
    currency: getCol(col.currency) ?? profile.defaultCurrency ?? "IDR",
    grossAmount: grossAmountStr,
    taxesCollected: taxesStr,
    cancellationFee: feeStr,
    commissionAmount: commAmountStr,
    guestName: getCol(col.guestName),
    countryCode: getCol(col.countryCode)?.slice(0, 2).toUpperCase(),
    collectType,
    rawPayload: rawRecord,
  };

  const validation = safeValidateNormalizedBooking(candidate);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { errors };
  }

  return { booking: validation.data, errors };
}

/**
 * Menghasilkan pratinjau hingga maxRows baris (default 20 baris).
 */
export function previewCsv(
  content: string | Buffer,
  profile: CsvMappingProfile,
  maxRows = 20,
): CsvPreviewResult {
  const delimiter = profile.delimiter ?? ",";
  const allRows = parseCsvRows(content, delimiter);

  const headerIndex = (profile.headerRow ?? 1) - 1;
  if (allRows.length <= headerIndex) {
    return {
      headers: [],
      totalRows: 0,
      previewRows: [],
      validCount: 0,
      errorCount: 0,
    };
  }

  const headers = allRows[headerIndex]!;
  const dataRows = allRows.slice(headerIndex + 1);
  const totalRows = dataRows.length;

  const previewCount = Math.min(dataRows.length, maxRows);
  const previewRows: CsvRowPreview[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < previewCount; i++) {
    const row = dataRows[i]!;
    const rowNumber = headerIndex + 2 + i; // 1-indexed

    const rawRecord: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c]!;
      rawRecord[colName] = row[c] ?? "";
    }

    const { booking, errors } = mapRowToBooking(rawRecord, profile);
    const isValid = errors.length === 0 && !!booking;

    if (isValid) {
      validCount++;
    } else {
      errorCount++;
    }

    previewRows.push({
      rowNumber,
      raw: rawRecord,
      parsed: booking,
      errors: errors.length > 0 ? errors : undefined,
      isValid,
    });
  }

  return {
    headers,
    totalRows,
    previewRows,
    validCount,
    errorCount,
  };
}
