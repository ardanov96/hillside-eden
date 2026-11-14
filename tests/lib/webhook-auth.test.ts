/**
 * Unit test modul autentikasi webhook (src/lib/webhook-auth.ts).
 *
 * Fokus:
 * - Fail-closed: secret kosong / terlalu pendek → ditolak.
 * - Perbandingan secret resistant timing attack.
 * - HMAC WAJIB ber-timestamp (anti-replay); HMAC body-only ditolak.
 * - Parsing domain email: banding persis, tolak domain mencurigakan.
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  authenticateWebhookRequest,
  constantTimeEquals,
  extractBearerToken,
  isTrustedEmailDomain,
  parseEmailDomain,
  parseTimestampMs,
  verifyTimestampedSignature,
  WEBHOOK_MAX_SKEW_SECONDS,
  WEBHOOK_MIN_SECRET_LENGTH,
} from "@/lib/webhook-auth";

const SECRET = "test-direct-secret-key-12345678";

function makeHeaders(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("constantTimeEquals", () => {
  it("mengembalikan true untuk string identik", () => {
    expect(constantTimeEquals("abc123", "abc123")).toBe(true);
  });

  it("mengembalikan false untuk string berbeda", () => {
    expect(constantTimeEquals("abc123", "abc124")).toBe(false);
  });

  it("mengembalikan false untuk panjang berbeda atau kosong", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
    expect(constantTimeEquals("", "")).toBe(false);
    expect(constantTimeEquals("", "abc")).toBe(false);
  });
});

describe("extractBearerToken", () => {
  it("mengambil token dari header Bearer", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
    expect(extractBearerToken("  Bearer   abc123  ")).toBe("abc123");
  });

  it("mengembalikan null bila header kosong atau bukan pola Bearer", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken("Bearer ")).toBeNull();
  });
});

describe("parseTimestampMs", () => {
  it("menerjemahkan unix detik dan milidetik", () => {
    expect(parseTimestampMs("1700000000")).toBe(1700000000000);
    expect(parseTimestampMs("1700000000123")).toBe(1700000000123);
  });

  it("menerjemahkan ISO-8601", () => {
    expect(parseTimestampMs("2026-01-01T00:00:00.000Z")).toBe(
      Date.parse("2026-01-01T00:00:00.000Z"),
    );
  });

  it("mengembalikan null untuk nilai tidak valid", () => {
    expect(parseTimestampMs(null)).toBeNull();
    expect(parseTimestampMs("")).toBeNull();
    expect(parseTimestampMs("bukan-angka")).toBeNull();
  });
});

describe("verifyTimestampedSignature", () => {
  const rawBody = JSON.stringify({ bookingId: "HE-1" });
  const timestamp = "1700000000";

  function sign(payload: string): string {
    return createHmac("sha256", SECRET).update(payload).digest("base64");
  }

  it("menerima HMAC atas `timestamp.body` (base64 dan hex)", () => {
    const payload = `${timestamp}.${rawBody}`;
    const base64 = sign(payload);
    const hex = createHmac("sha256", SECRET).update(payload).digest("hex");

    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp,
        signature: base64,
        secret: SECRET,
        nowMs: 1700000000000,
      }),
    ).toEqual({ ok: true });

    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp,
        signature: hex,
        secret: SECRET,
        nowMs: 1700000000000,
      }),
    ).toEqual({ ok: true });
  });

  it("menolak HMAC tanpa timestamp (dapat direplay selamanya)", () => {
    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp: null,
        signature: sign(rawBody),
        secret: SECRET,
        nowMs: 1700000000000,
      }),
    ).toEqual({ ok: false, reason: "missing-timestamp" });
  });

  it("menolak HMAC dengan timestamp basi (di luar jendela skew)", () => {
    const nowMs = 1700000000000;
    const stale = String(Math.floor(nowMs / 1000) - WEBHOOK_MAX_SKEW_SECONDS - 60);
    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp: stale,
        signature: sign(`${stale}.${rawBody}`),
        secret: SECRET,
        nowMs,
      }),
    ).toEqual({ ok: false, reason: "stale-timestamp" });
  });

  it("menolak signature yang salah", () => {
    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp,
        signature: "signature-palsu",
        secret: SECRET,
        nowMs: 1700000000000,
      }),
    ).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("menolak timestamp tidak valid", () => {
    expect(
      verifyTimestampedSignature({
        rawBody,
        timestamp: "bukan-angka",
        signature: sign(`bukan-angka.${rawBody}`),
        secret: SECRET,
        nowMs: 1700000000000,
      }),
    ).toEqual({ ok: false, reason: "invalid-timestamp" });
  });
});

describe("authenticateWebhookRequest", () => {
  const rawBody = JSON.stringify({ bookingId: "HE-1" });

  it("gagal tertutup bila secret belum dikonfigurasi", () => {
    expect(
      authenticateWebhookRequest({ secret: undefined, rawBody, headers: makeHeaders({}) }),
    ).toEqual({ ok: false, reason: "secret webhook belum dikonfigurasi" });

    expect(authenticateWebhookRequest({ secret: "", rawBody, headers: makeHeaders({}) })).toEqual({
      ok: false,
      reason: "secret webhook belum dikonfigurasi",
    });
  });

  it("gagal tertutup bila secret terlalu pendek", () => {
    expect(
      authenticateWebhookRequest({
        secret: "pendek",
        rawBody,
        headers: makeHeaders({ "x-webhook-secret": "pendek" }),
      }),
    ).toEqual({ ok: false, reason: "secret webhook belum dikonfigurasi" });
  });

  it("menerima shared secret lewat header x-webhook-secret", () => {
    expect(
      authenticateWebhookRequest({
        secret: SECRET,
        rawBody,
        headers: makeHeaders({ "x-webhook-secret": SECRET }),
      }),
    ).toEqual({ ok: true, method: "shared-secret" });
  });

  it("menerima shared secret lewat Authorization: Bearer", () => {
    expect(
      authenticateWebhookRequest({
        secret: SECRET,
        rawBody,
        headers: makeHeaders({ authorization: `Bearer ${SECRET}` }),
      }),
    ).toEqual({ ok: true, method: "shared-secret" });
  });

  it("menolak shared secret yang salah", () => {
    expect(
      authenticateWebhookRequest({
        secret: SECRET,
        rawBody,
        headers: makeHeaders({ "x-webhook-secret": "secret-yang-salah-123456" }),
      }),
    ).toEqual({ ok: false, reason: "secret atau signature tidak valid" });
  });

  it("menerima HMAC ber-timestamp yang valid", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("base64");

    expect(
      authenticateWebhookRequest({
        secret: SECRET,
        rawBody,
        headers: makeHeaders({
          "x-wc-webhook-signature": signature,
          "x-webhook-timestamp": timestamp,
        }),
      }),
    ).toEqual({ ok: true, method: "hmac" });
  });

  it("menolak HMAC lama (atas body saja) karena dapat direplay", () => {
    const signature = createHmac("sha256", SECRET).update(rawBody).digest("base64");
    const result = authenticateWebhookRequest({
      secret: SECRET,
      rawBody,
      headers: makeHeaders({ "x-wc-webhook-signature": signature }),
    });
    expect(result.ok).toBe(false);
  });

  it("menolak HMAC dengan timestamp basi", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - WEBHOOK_MAX_SKEW_SECONDS - 60);
    const signature = createHmac("sha256", SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("base64");
    const result = authenticateWebhookRequest({
      secret: SECRET,
      rawBody,
      headers: makeHeaders({
        "x-wc-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
      }),
    });
    expect(result.ok).toBe(false);
  });

  it("menolak request tanpa secret maupun signature", () => {
    expect(
      authenticateWebhookRequest({ secret: SECRET, rawBody, headers: makeHeaders({}) }),
    ).toEqual({ ok: false, reason: "secret atau signature tidak valid" });
  });

  it("memakai panjang minimum secret yang konsisten", () => {
    expect(WEBHOOK_MIN_SECRET_LENGTH).toBe(16);
  });
});

describe("parseEmailDomain", () => {
  it("mengambil domain dari alamat polos", () => {
    expect(parseEmailDomain("automated@airbnb.com")).toBe("airbnb.com");
    expect(parseEmailDomain("No-Reply@Tiket.COM")).toBe("tiket.com");
  });

  it("mengambil domain dari format display name", () => {
    expect(parseEmailDomain("Airbnb <automated@airbnb.com>")).toBe("airbnb.com");
  });

  it("mengembalikan null untuk alamat tidak valid", () => {
    expect(parseEmailDomain("")).toBeNull();
    expect(parseEmailDomain(null)).toBeNull();
    expect(parseEmailDomain("tanpa-at-sign.example.com")).toBeNull();
    expect(parseEmailDomain("@airbnb.com")).toBeNull();
    expect(parseEmailDomain("user@localhost")).toBeNull();
  });
});

describe("isTrustedEmailDomain", () => {
  const trusted = ["airbnb.com", "tiket.com", "traveloka.com"] as const;

  it("menerima domain persis dan subdomainnya", () => {
    expect(isTrustedEmailDomain("airbnb.com", trusted)).toBe(true);
    expect(isTrustedEmailDomain("mailer.airbnb.com", trusted)).toBe(true);
    expect(isTrustedEmailDomain("tiket.com", trusted)).toBe(true);
  });

  it("menolak domain mencurigakan / menyamar", () => {
    expect(isTrustedEmailDomain("airbnb.com.evil.com", trusted)).toBe(false);
    expect(isTrustedEmailDomain("notairbnb.com", trusted)).toBe(false);
    expect(isTrustedEmailDomain("airbnb.com.evil.co.id", trusted)).toBe(false);
    expect(isTrustedEmailDomain(null, trusted)).toBe(false);
  });
});
