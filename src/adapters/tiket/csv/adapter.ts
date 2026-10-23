/**
 * Adapter CSV Tiket.com (S6-02).
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseTiketReservationsCsv } from "./parser";

export class TiketCsvAdapter implements SourceAdapter {
  readonly id = "tiket.csv.v1";
  readonly channel = "TIKET_COM" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    const isTiketHeader =
      (lower.includes("order id") || lower.includes("no. pesanan")) &&
      (lower.includes("total tarif") ||
        lower.includes("check in") ||
        lower.includes("status pesanan"));

    const isTiketFilename = input.filename?.toLowerCase().includes("tiket");

    return isTiketHeader || (isTiketFilename && lower.includes("order id"));
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "TiketCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const { events, errors } = parseTiketReservationsCsv(contentStr);

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Tiket.com: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
