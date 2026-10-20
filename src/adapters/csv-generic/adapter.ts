/**
 * Adapter CSV Generik Berdasarkan Profil Pemetaan (docs/06 §7, tiket S2-05).
 * Mengimplementasikan kontrak SourceAdapter.
 */

import type {
  ChannelCode,
  EventType,
  ParsedBookingEvent,
  ParseResult,
  RawInput,
  SourceAdapter,
} from "../types";
import { parseCsvRows } from "./csv-tokenizer";
import { mapRowToBooking } from "./preview";
import type { CsvMappingProfile } from "./profile";

export class GenericCsvAdapter implements SourceAdapter {
  readonly id: string;
  readonly channel: ChannelCode;
  private readonly profile: CsvMappingProfile;

  constructor(profile: CsvMappingProfile, id = "csv.generic.v1") {
    this.profile = profile;
    this.id = id;
    this.channel = profile.channel ?? "MANUAL";
  }

  supports(input: RawInput): boolean {
    if (input.kind === "csv") return true;
    return false;
  }

  parse(input: RawInput): ParseResult {
    if (!this.supports(input) || input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: `GenericCsvAdapter hanya mendukung RawInput jenis 'csv', menerima '${input.kind}'`,
      };
    }

    const delimiter = this.profile.delimiter ?? ",";
    let allRows: string[][];
    try {
      allRows = parseCsvRows(input.content, delimiter);
    } catch (e) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal membaca format CSV: ${(e as Error).message}`,
      };
    }

    const headerIndex = (this.profile.headerRow ?? 1) - 1;
    if (allRows.length <= headerIndex) {
      return {
        ok: false,
        errorCode: "MISSING_FIELD",
        message: `Berkas CSV kosong atau tidak memiliki baris header pada baris ${headerIndex + 1}`,
      };
    }

    const headers = allRows[headerIndex]!;
    const dataRows = allRows.slice(headerIndex + 1);

    if (dataRows.length === 0) {
      return {
        ok: false,
        errorCode: "MISSING_FIELD",
        message: "Berkas CSV tidak memuat baris data",
      };
    }

    const events: ParsedBookingEvent[] = [];
    const allWarnings: string[] = [];
    let failureCount = 0;

    const now = new Date();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      const rowNum = headerIndex + 2 + i;

      const record: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        const col = headers[c]!;
        record[col] = row[c] ?? "";
      }

      const { booking, errors } = mapRowToBooking(record, this.profile);

      if (errors.length > 0 || !booking) {
        failureCount++;
        allWarnings.push(`Baris ${rowNum}: ${errors.join("; ")}`);
        continue;
      }

      const eventType: EventType =
        booking.status === "CANCELLED"
          ? "CANCELLED"
          : booking.status === "NO_SHOW"
            ? "NO_SHOW"
            : "CREATED";

      events.push({
        eventType,
        occurredAt: booking.bookedAt ?? now,
        booking,
        confidence: "high",
        warnings: [],
      });
    }

    if (events.length === 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Semua baris (${failureCount}) gagal diurai sesuai profil pemetaan: ${allWarnings.slice(0, 3).join(" | ")}`,
        details: { allWarnings },
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
