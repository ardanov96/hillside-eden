/**
 * Antarmuka InboundEmailSource & Layanan Pemrosesan Email Masuk (S5-05 / OD-04).
 *
 * Menerima email masuk (webhook atau polling), memverifikasi domain pengirim,
 * menyimpan payload mentah, dan meneruskannya ke IngestPipeline.
 */
import type { PrismaClient } from "@prisma/client";
import type { RawInput } from "@/adapters/types";
import type { StorageProvider } from "@/ingest/storage/provider";
import { runIngest, type PipelineResult } from "@/ingest/pipeline/pipeline";
import { createRouterRegistry } from "@/ingest/pipeline/router";
import { AirbnbEmailAdapter } from "@/adapters/airbnb/email/adapter";
import { AirbnbCsvAdapter } from "@/adapters/airbnb/csv/adapter";
import { TiketEmailAdapter } from "@/adapters/tiket/email/adapter";
import { TravelokaEmailAdapter } from "@/adapters/traveloka/email/adapter";

export interface InboundEmailPayload {
  from: string;
  to?: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  rawEml?: Buffer | string;
}

export interface InboundEmailSource {
  readonly id: string;
  process(payload: InboundEmailPayload): Promise<PipelineResult>;
}

// Daftar putih domain pengirim yang dipercaya (docs/06 §5)
export const TRUSTED_EMAIL_DOMAINS = [
  "airbnb.com",
  "automated.airbnb.com",
  "tiket.com",
  "traveloka.com",
] as const;

export function isTrustedEmailSender(fromAddress: string): boolean {
  const lower = fromAddress.toLowerCase();
  return TRUSTED_EMAIL_DOMAINS.some(
    (domain) => lower.includes(`@${domain}`) || lower.endsWith(`.${domain}`),
  );
}

export interface ProcessInboundEmailContext {
  prisma: PrismaClient;
  organizationId: string;
  storage?: StorageProvider;
}

/**
 * Memproses email masuk secara aman dan deterministik.
 */
export async function processInboundEmail(
  payload: InboundEmailPayload,
  ctx: ProcessInboundEmailContext,
): Promise<PipelineResult> {
  const receivedAt = new Date();

  // 1. Simpan raw EML bila storage provider tersedia
  let storageKey: string | undefined;
  if (ctx.storage && payload.rawEml) {
    const rawBuffer = Buffer.isBuffer(payload.rawEml)
      ? payload.rawEml
      : Buffer.from(payload.rawEml, "utf-8");
    const key = `inbound-emails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.eml`;
    const stored = await ctx.storage.put(key, rawBuffer, {
      contentType: "message/rfc822",
    });
    storageKey = stored.key;
  }

  // 2. Bentuk RawInput
  const rawInput: RawInput = {
    kind: "email",
    receivedAt,
    from: payload.from,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: payload.headers,
    storageKey,
  };

  // 3. Inisialisasi router dengan semua adapter email OTA
  const router = createRouterRegistry([
    new AirbnbEmailAdapter(),
    new AirbnbCsvAdapter(),
    new TiketEmailAdapter(),
    new TravelokaEmailAdapter(),
  ]);

  // 4. Jalankan IngestPipeline
  return runIngest(ctx.prisma, router, {
    organizationId: ctx.organizationId,
    kind: "EMAIL",
    storageKey,
    rawInput,
  });
}
