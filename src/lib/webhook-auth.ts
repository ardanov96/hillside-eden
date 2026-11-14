/**
 * Autentikasi endpoint webhook (server-to-server).
 *
 * Modul murni (tanpa I/O, tanpa import Next.js) supaya aturan keamanan
 * webhook dapat diuji secara deterministik.
 *
 * Prinsip (docs/08-quality-security-ops.md §3):
 * - **Fail-closed**: secret webhook wajib dikonfigurasi. Bila env kosong,
 *   endpoint harus menolak request, bukan menerima semuanya.
 * - Perbandingan secret memakai `timingSafeEqual` (bukan `includes`/===).
 * - Tanda tangan HMAC harus **memuat timestamp** dan ditandatangani atas
 *   `timestamp + "." + body`, sehingga request yang tertangkap hanya bisa
 *   dipakai ulang dalam jendela waktu singkat (anti-replay).
 *
 * Referensi: ADR-030, docs/08 §3.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Jendela toleransi skew timestamp (detik). Default 5 menit. */
export const WEBHOOK_MAX_SKEW_SECONDS = 300;

/** Panjang minimum secret webhook yang diterima (karakter). */
export const WEBHOOK_MIN_SECRET_LENGTH = 16;

/**
 * Perbandingan string resistant timing attack.
 * Panjang berbeda langsung `false` (timingSafeEqual mensyaratkan sama panjang).
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Ambil token dari header `Authorization: Bearer <token>`.
 * Mengembalikan null bila header kosong atau bukan pola Bearer.
 */
export function extractBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Parse timestamp header (unix detik atau ISO-8601) menjadi epoch milidetik.
 * Mengembalikan null bila tidak valid.
 */
export function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  // Unix detik (10 digit) atau unix milidetik (13 digit).
  if (/^\d{10,13}$/.test(raw)) {
    const num = Number(raw);
    return raw.length <= 10 ? num * 1000 : num;
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Hasil verifikasi tanda tangan HMAC ber-timestamp. */
export type HmacVerification =
  | { ok: true }
  | {
      ok: false;
      reason: "missing-timestamp" | "invalid-timestamp" | "stale-timestamp" | "bad-signature";
    };

/**
 * Verifikasi HMAC-SHA256 atas `timestamp + "." + rawBody`.
 * Header signature boleh base64 (format WooCommerce) maupun hex.
 */
export function verifyTimestampedSignature(input: {
  rawBody: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  secret: string;
  nowMs?: number;
  maxSkewSeconds?: number;
}): HmacVerification {
  const { rawBody, timestamp, signature, secret } = input;
  if (!signature || !signature.trim()) {
    return { ok: false, reason: "bad-signature" };
  }
  if (!timestamp || !timestamp.trim()) {
    // Tanpa timestamp, request bisa direplay selamanya → ditolak.
    return { ok: false, reason: "missing-timestamp" };
  }

  const timestampMs = parseTimestampMs(timestamp);
  if (timestampMs === null) {
    return { ok: false, reason: "invalid-timestamp" };
  }

  const nowMs = input.nowMs ?? Date.now();
  const maxSkewSeconds = input.maxSkewSeconds ?? WEBHOOK_MAX_SKEW_SECONDS;
  if (Math.abs(nowMs - timestampMs) > maxSkewSeconds * 1000) {
    return { ok: false, reason: "stale-timestamp" };
  }

  const payload = `${timestamp.trim()}.${rawBody}`;
  // Catatan: `Hmac.digest()` hanya boleh dipanggil sekali, jadi hitung base64
  // dan hex dari instance terpisah.
  const expectedBase64 = createHmac("sha256", secret).update(payload, "utf8").digest("base64");
  const expectedHex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  const provided = signature.trim();

  if (constantTimeEquals(provided, expectedBase64) || constantTimeEquals(provided, expectedHex)) {
    return { ok: true };
  }
  return { ok: false, reason: "bad-signature" };
}

/** Hasil autentikasi satu request webhook. */
export type WebhookAuthResult =
  { ok: true; method: "shared-secret" | "hmac" } | { ok: false; reason: string };

export interface WebhookAuthInput {
  /** Secret yang dikonfigurasi di env (wajib ada; pemanggil harus fail-closed). */
  secret: string | null | undefined;
  /** Body request apa adanya (string), dipakai untuk HMAC. */
  rawBody: string;
  /** Header request. */
  headers: Headers;
  /** Waktu sekarang (ms) — dapat di-inject untuk tes. */
  nowMs?: number;
  /** Maksimum skew timestamp (detik). */
  maxSkewSeconds?: number;
}

/**
 * Autentikasi request webhook.
 *
 * Cara yang diterima:
 * 1. Header `x-webhook-secret` berisi secret persis (ATAU `Authorization: Bearer <secret>`).
 *    Bila `x-webhook-timestamp` ikut dikirim, skew-nya tetap diperiksa.
 * 2. Header `x-wc-webhook-signature` + `x-webhook-timestamp` (HMAC atas
 *    `timestamp + "." + body`) —recommended, anti-replay.
 *
 * HMAC lama (signature atas body tanpa timestamp) **ditolak** karena bisa
 * direplay tanpa batas waktu.
 */
export function authenticateWebhookRequest(input: WebhookAuthInput): WebhookAuthResult {
  const { secret, rawBody, headers } = input;

  if (!secret || secret.length < WEBHOOK_MIN_SECRET_LENGTH) {
    return { ok: false, reason: "secret webhook belum dikonfigurasi" };
  }

  const timestamp = headers.get("x-webhook-timestamp");
  const timestampMs = parseTimestampMs(timestamp);
  const nowMs = input.nowMs ?? Date.now();
  const maxSkewSeconds = input.maxSkewSeconds ?? WEBHOOK_MAX_SKEW_SECONDS;

  if (timestamp && timestampMs === null) {
    return { ok: false, reason: "timestamp tidak valid" };
  }
  if (timestampMs !== null && Math.abs(nowMs - timestampMs) > maxSkewSeconds * 1000) {
    return { ok: false, reason: "timestamp di luar jendela yang diizinkan" };
  }

  // 1. Shared secret (header x-webhook-secret atau Authorization: Bearer).
  const secretHeader = headers.get("x-webhook-secret");
  const bearer = extractBearerToken(headers.get("authorization"));
  const candidates = [secretHeader?.trim(), bearer].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  for (const candidate of candidates) {
    if (constantTimeEquals(candidate, secret)) {
      return { ok: true, method: "shared-secret" };
    }
  }

  // 2. HMAC ber-timestamp.
  const signature = headers.get("x-wc-webhook-signature");
  if (signature) {
    const hmac = verifyTimestampedSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowMs,
      maxSkewSeconds,
    });
    if (hmac.ok) {
      return { ok: true, method: "hmac" };
    }
    return { ok: false, reason: `signature tidak valid (${hmac.reason})` };
  }

  return { ok: false, reason: "secret atau signature tidak valid" };
}

/**
 * Ambil domain dari alamat email.
 * Menangani format "Nama <alamat@domain>" dan membuang domain dalam tanda kutip.
 */
export function parseEmailDomain(address: string | null | undefined): string | null {
  if (!address) return null;
  let value = address.trim();
  const angle = /<([^>]+)>\s*$/.exec(value);
  if (angle?.[1]) {
    value = angle[1].trim();
  }
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  const domain = value
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!domain || !domain.includes(".") || domain.includes(" ")) return null;
  return domain;
}

/**
 * Apakah domain tercakup whitelist.
 * Hanya domain persis atau subdomain thereof yang dianggap tepercaya
 * (`mailer.airbnb.com` OK, `airbnb.com.evil.com` TIDAK).
 */
export function isTrustedEmailDomain(domain: string | null, trusted: readonly string[]): boolean {
  if (!domain) return false;
  const normalized = domain.toLowerCase().replace(/\.$/, "");
  return trusted.some((allowed) => {
    const t = allowed.toLowerCase();
    return normalized === t || normalized.endsWith(`.${t}`);
  });
}
