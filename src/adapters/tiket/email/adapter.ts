/**
 * Adapter Email Tiket.com (S6-02).
 */
import type { SourceAdapter, RawInput, ParseResult } from "@/adapters/types";
import { parseTiketEmail } from "./parser";

export class TiketEmailAdapter implements SourceAdapter {
  readonly id = "tiket.email.v1";
  readonly channel = "TIKET_COM" as const;

  supports(input: RawInput): boolean {
    if (input.kind !== "email") return false;
    const fromLower = input.from.toLowerCase();
    return fromLower.includes("tiket.com");
  }

  async parse(input: RawInput): Promise<ParseResult> {
    if (input.kind !== "email") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: "TiketEmailAdapter hanya mendukung RawInput bertipe email",
      };
    }

    const res = parseTiketEmail({
      from: input.from,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (res.error || !res.event) {
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: res.error || "Gagal mem-parse email Tiket.com",
      };
    }

    return {
      ok: true,
      events: [res.event],
    };
  }
}
