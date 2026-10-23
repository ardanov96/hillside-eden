/**
 * Adapter CSV Airbnb (S5-02).
 *
 * Mengimplementasikan kontrak SourceAdapter untuk berkas ekspor CSV dari Airbnb.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseAirbnbReservationsCsv } from "./reservations-parser";
import { parseAirbnbPayoutCsv } from "./payout-parser";

export class AirbnbCsvAdapter implements SourceAdapter {
  readonly id = "airbnb.csv.v1";
  readonly channel = "AIRBNB" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1500).toLowerCase();

    // Cek ciri khas header ekspor Airbnb
    const isReservation =
      (lower.includes("confirmation code") || lower.includes("kode konfirmasi")) &&
      (lower.includes("earnings") || lower.includes("listing") || lower.includes("# of nights"));

    const isPayout =
      lower.includes("paid out") ||
      (lower.includes("type") && lower.includes("details") && lower.includes("amount"));

    const isAirbnbName = input.filename?.toLowerCase().includes("airbnb");

    return isReservation || isPayout || (isAirbnbName && lower.includes("confirmation"));
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "csv") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "AirbnbCsvAdapter hanya mendukung RawInput bertipe csv",
      };
    }

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const lower = contentStr.slice(0, 1000).toLowerCase();

    // 1. Ekspor Transaksi / Payout
    if (lower.includes("paid out") || (lower.includes("type") && lower.includes("details"))) {
      const { payouts, errors } = parseAirbnbPayoutCsv(contentStr);
      if (payouts.length === 0 && errors.length > 0) {
        return {
          ok: false,
          errorCode: "INVALID_VALUE",
          message: `Gagal mem-parse transaksi Airbnb: ${errors.join("; ")}`,
        };
      }
      return {
        ok: true,
        events: [],
        payouts,
      };
    }

    // 2. Ekspor Reservasi
    const { events, errors } = parseAirbnbReservationsCsv(contentStr, {
      filename: input.filename,
    });

    if (events.length === 0 && errors.length > 0) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: `Gagal mem-parse reservasi Airbnb: ${errors.join("; ")}`,
      };
    }

    return {
      ok: true,
      events,
    };
  }
}
