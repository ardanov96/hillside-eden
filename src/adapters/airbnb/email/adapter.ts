/**
 * Adapter Email Airbnb (S5-03).
 *
 * Mengimplementasikan SourceAdapter untuk email konfirmasi, perubahan,
 * dan pembatalan dari Airbnb.
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseAirbnbEmail } from "./parser";

export class AirbnbEmailAdapter implements SourceAdapter {
  readonly id = "airbnb.email.v1";
  readonly channel = "AIRBNB" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "email") return false;
    const fromLower = input.from.toLowerCase();
    return fromLower.includes("airbnb.com");
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "email") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "AirbnbEmailAdapter hanya mendukung RawInput bertipe email",
      };
    }

    const res = parseAirbnbEmail({
      from: input.from,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (res.error || !res.event) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: res.error || "Gagal mengekstrak event reservasi Airbnb dari email",
      };
    }

    return {
      ok: true,
      events: [res.event],
    };
  }
}
