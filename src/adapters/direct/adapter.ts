/**
 * DirectWebhookAdapter - Adapter Webhook Direct Booking (hillsideedenubud.com).
 *
 * Mengimplementasikan kontrak SourceAdapter untuk memproses event pemesanan
 * langsung yang dikirim via HTTP Webhook dari website resmi.
 */

import { type ChannelCode, type ParseResult, type RawInput, type SourceAdapter } from "../types";
import { parseDirectWebhookPayload } from "./parser";

export const DIRECT_WEBHOOK_ADAPTER_ID = "direct.webhook.v1" as const;

export class DirectWebhookAdapter implements SourceAdapter {
  readonly id = DIRECT_WEBHOOK_ADAPTER_ID;
  readonly channel: ChannelCode = "DIRECT";

  supports(input: RawInput): boolean {
    if (input.kind === "webhook" && input.channel === "DIRECT") {
      return true;
    }
    if (
      input.kind === "manual" &&
      typeof input.payload === "object" &&
      input.payload !== null &&
      (input.payload as Record<string, unknown>).source === "direct-website"
    ) {
      return true;
    }
    return false;
  }

  parse(input: RawInput): ParseResult {
    if (!this.supports(input)) {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: `DirectWebhookAdapter hanya mendukung RawInput jenis 'webhook' channel 'DIRECT', menerima '${input.kind}'`,
      };
    }

    const payload = input.kind === "webhook" || input.kind === "manual" ? input.payload : undefined;
    return parseDirectWebhookPayload(payload);
  }
}
