/**
 * Adapter CSV Expedia Partner Central.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseExpediaReservationsCsv } from "./parser";

export class ExpediaCsvAdapter implements SourceAdapter {
  readonly id = "expedia.csv.v1";
  readonly channel = "EXPEDIA" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    const isExpediaHeader =
      (lower.includes("reservation id") || lower.includes("itinerary number")) &&
      (lower.includes("stay date") ||
        lower.includes("total booking value") ||
        lower.includes("expedia"));

    const isExpediaFilename =
      input.filename?.toLowerCase().includes("expedia") ||
      input.filename?.toLowerCase().includes("epc");

    return isExpediaHeader || (Boolean(isExpediaFilename) && lower.includes("reservation id"));
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "ExpediaCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const { events, errors } = parseExpediaReservationsCsv(contentStr);

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Expedia: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
