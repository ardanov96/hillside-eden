/**
 * Adapter Email Traveloka (S6-03).
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseTravelokaEmail } from "./parser";

export class TravelokaEmailAdapter implements SourceAdapter {
  readonly id = "traveloka.email.v1";
  readonly channel = "TRAVELOKA" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "email") return false;
    const fromLower = input.from.toLowerCase();
    return fromLower.includes("traveloka.com");
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "email") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "TravelokaEmailAdapter hanya mendukung RawInput bertipe email",
      };
    }

    const res = parseTravelokaEmail({
      from: input.from,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (res.error || !res.event) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: res.error || "Gagal mem-parse email Traveloka",
      };
    }

    return {
      ok: true,
      events: [res.event],
    };
  }
}
