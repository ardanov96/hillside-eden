/**
 * Adapter CSV Traveloka (S6-03).
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseTravelokaReservationsCsv } from "./parser";

export class TravelokaCsvAdapter implements SourceAdapter {
  readonly id = "traveloka.csv.v1";
  readonly channel = "TRAVELOKA" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    const isTravelokaHeader =
      (lower.includes("booking id") ||
        lower.includes("no. pemesanan") ||
        lower.includes("itinerary id")) &&
      (lower.includes("check-in") || lower.includes("total amount") || lower.includes("tarif"));

    const isTravelokaName = input.filename?.toLowerCase().includes("traveloka");

    return isTravelokaHeader || (isTravelokaName && lower.includes("booking id"));
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "TravelokaCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const { events, errors } = parseTravelokaReservationsCsv(contentStr);

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Traveloka: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
