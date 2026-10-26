/**
 * Adapter CSV Booking.com Extranet.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseBookingComReservationsCsv } from "./parser";

export class BookingComCsvAdapter implements SourceAdapter {
  readonly id = "booking_com.csv.v1";
  readonly channel = "BOOKING_COM" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    const isBookingHeader =
      (lower.includes("book number") ||
        lower.includes("reservation number") ||
        lower.includes("booking number")) &&
      (lower.includes("check-in") || lower.includes("total amount") || lower.includes("room type"));

    const isBookingFilename =
      input.filename?.toLowerCase().includes("booking") ||
      input.filename?.toLowerCase().includes("bcom");

    return isBookingHeader || (Boolean(isBookingFilename) && lower.includes("book number"));
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "BookingComCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const { events, errors } = parseBookingComReservationsCsv(contentStr);

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Booking.com: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
