/**
 * Adapter CSV Agoda YCS Extranet.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseAgodaReservationsCsv } from "./parser";

export class AgodaCsvAdapter implements SourceAdapter {
  readonly id = "agoda.csv.v1";
  readonly channel = "AGODA" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    // 1. Header Agoda YCS Extranet
    const isAgodaYcsHeader =
      (lower.includes("booking id") || lower.includes("reference id")) &&
      (lower.includes("total inclusive rate") ||
        lower.includes("customer name") ||
        lower.includes("room type"));

    // 2. Header Agoda Partner Portal (Agoda Homes)
    // Contoh: PropertyName,BookingId,GuestName,CheckinDate,CheckoutDate,RoomTypeName,Adults,Children,PaymentModel
    const isAgodaHomesHeader =
      lower.includes("bookingid") &&
      (lower.includes("propertyname") ||
        lower.includes("checkindate") ||
        lower.includes("roomtypename") ||
        lower.includes("paymentmodel"));

    const isAgodaFilename =
      input.filename?.toLowerCase().includes("agoda") ||
      input.filename?.toLowerCase().includes("ycs") ||
      input.filename?.toLowerCase().startsWith("booking-report-");

    return (
      isAgodaYcsHeader ||
      isAgodaHomesHeader ||
      (Boolean(isAgodaFilename) && (lower.includes("booking id") || lower.includes("bookingid")))
    );
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "AgodaCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const { events, errors } = parseAgodaReservationsCsv(contentStr);

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Agoda: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
