/**
 * Adapter CSV Agoda (YCS Extranet & Agoda Partner Portal).
 *
 * Deteksi file "YCS Extranet" dan "Partner Portal" (Agoda Homes) sama-sama
 * dipakai. Ekspor "Reservasi" dari Agoda Partner Portal bisa diekspor dengan kolom
 * berbeda-beda sesuai filter yang dipilih pengguna, sehingga adapter ini
 * mengenali file berdasarkan kolom ID reservasi + penanda khas Agoda, bukan
 * berdasarkan daftar kolom tetap.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { parseAgodaReservationsCsv } from "./parser";
import {
  AGODA_COLUMN_ALIASES,
  detectAgodaHeaderRow,
  findAgodaColumn,
  hasAgodaMarker,
  normalizeHeader,
} from "./mappings";

export class AgodaCsvAdapter implements SourceAdapter {
  readonly id = "agoda.csv.v1";
  readonly channel = "AGODA" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "csv") return false;

    const contentStr =
      typeof input.content === "string" ? input.content : input.content.toString("utf-8");

    const rows = parseCsvRows(contentStr);
    const header = detectAgodaHeaderRow(rows) ?? detectLooseHeaderRow(rows);
    if (!header) return false;

    const hasMarker = hasAgodaMarker(header.headers);
    if (hasMarker) return true;

    // Tanpa penanda khas: hanya diterima bila nama berkasnya pola ekspor Agoda.
    const filename = (input.filename ?? "").toLowerCase();
    const filenameLooksAgoda =
      /booking[-_ ]?report/.test(filename) ||
      filename.includes("agoda") ||
      filename.includes("ycs");

    return filenameLooksAgoda;
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

/**
 * Deteksi longgar: baris pertama yang memuat kolom ID reservasi Agoda.
 * Dipakai untuk `supports()` supaya berkas dengan kolom minimal (mis. hanya
 * "Booking ID") tetap dikenali bila nama berkasnya pola ekspor Agoda.
 */
function detectLooseHeaderRow(
  rows: readonly string[][],
): { rowIndex: number; headers: string[]; original: string[] } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if ((row[0] ?? "").trim().startsWith("#")) continue;
    const original = row.map((c) => (c ?? "").trim());
    const headers = original.map((c) => normalizeHeader(c));
    if (findAgodaColumn(headers, AGODA_COLUMN_ALIASES.bookingId, new Set()) >= 0) {
      return { rowIndex: i, headers, original };
    }
  }
  return null;
}
