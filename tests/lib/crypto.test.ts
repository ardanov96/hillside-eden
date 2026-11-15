/**
 * Unit test untuk modul enkripsi simetris dan masking URL iCal (S9-02).
 *
 * Termasuk aturan kunci (ADR-031): `ENCRYPTION_KEY` wajib di produksi dan
 * tidak ada fallback ke kunci literal yang tercetak di repo.
 */
import { describe, expect, it, afterEach } from "vitest";
import {
  decryptText,
  decryptTextWithKey,
  deriveEncryptionKey,
  encryptText,
  encryptTextWithKey,
  maskIcalUrl,
  resolveEncryptionKey,
} from "@/lib/crypto";

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ORIGINAL_AUTH_SECRET = process.env.AUTH_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** Set/reset env tanpa memicu error tipe pada `readonly NODE_ENV`. */
function setEnv(key: string, value: string | undefined): void {
  const target = process.env as unknown as Record<string, string | undefined>;
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

afterEach(() => {
  setEnv("ENCRYPTION_KEY", ORIGINAL_ENCRYPTION_KEY);
  setEnv("AUTH_SECRET", ORIGINAL_AUTH_SECRET);
  setEnv("NODE_ENV", ORIGINAL_NODE_ENV);
});

describe("crypto utility (S9-02)", () => {
  it("dapat mengenkripsi dan mendekripsi string dengan benar (round-trip)", () => {
    const original = "https://www.airbnb.com/calendar/ical/12345.ics?s=abcdef123456";
    const encrypted = encryptText(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:cipher

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(original);
  });

  it("menangani string kosong secara aman", () => {
    expect(encryptText("")).toBe("");
    expect(decryptText("")).toBe("");
  });

  it("mengembalikan teks apa adanya jika format bukan cipher valid", () => {
    const plainUrl = "https://example.com/calendar.ics";
    expect(decryptText(plainUrl)).toBe(plainUrl);
  });

  it("menyamarkan parameter query rahasia pada maskIcalUrl", () => {
    const secretUrl = "https://www.airbnb.com/calendar/ical/999.ics?s=supersecretkey&token=123";
    const masked = maskIcalUrl(secretUrl);

    expect(masked).toContain("https://www.airbnb.com/calendar/ical/999.ics");
    expect(masked).not.toContain("supersecretkey");
    expect(masked).not.toContain("123");
    expect(masked).toContain("s=***");
    expect(masked).toContain("token=***");
  });

  it("menangani URL tanpa parameter query dengan aman", () => {
    const url = "https://example.com/feed.ics";
    expect(maskIcalUrl(url)).toBe(url);
  });
});

describe("penentuan kunci enkripsi (ADR-031)", () => {
  it("menolak produksi tanpa ENCRYPTION_KEY (tidak ada fallback literal)", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ENCRYPTION_KEY", undefined);
    setEnv("AUTH_SECRET", "a".repeat(32));

    expect(() => resolveEncryptionKey()).toThrow(/ENCRYPTION_KEY wajib/);
  });

  it("menolak ENCRYPTION_KEY yang terlalu pendek", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ENCRYPTION_KEY", "pendek");

    expect(() => resolveEncryptionKey()).toThrow(/terlalu pendek/);
  });

  it("memakai ENCRYPTION_KEY di produksi", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ENCRYPTION_KEY", "k".repeat(32));

    const key = resolveEncryptionKey();
    expect(key).toHaveLength(32);
    expect(key.equals(deriveEncryptionKey("k".repeat(32)))).toBe(true);
  });

  it("tidak memakai AUTH_SECRET di produksi saat ENCRYPTION_KEY tersedia", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ENCRYPTION_KEY", "k".repeat(32));
    setEnv("AUTH_SECRET", "s".repeat(32));

    const key = resolveEncryptionKey();
    expect(key.equals(deriveEncryptionKey("s".repeat(32)))).toBe(false);
  });

  it("menurunkan kunci dari AUTH_SECRET di luar produksi", () => {
    setEnv("NODE_ENV", "development");
    setEnv("ENCRYPTION_KEY", undefined);
    setEnv("AUTH_SECRET", "s".repeat(32));

    const key = resolveEncryptionKey();
    expect(key.equals(deriveEncryptionKey("s".repeat(32)))).toBe(true);
  });

  it("encryptText gagal (fail-closed) bila kunci tidak tersedia di produksi", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ENCRYPTION_KEY", undefined);
    setEnv("AUTH_SECRET", "s".repeat(32));

    expect(() => encryptText("https://airbnb.com/calendar.ics?s=rahasia")).toThrow();
  });

  it("dekripsi gagal bila kunci berubah (tidak diam-diam mengembalikan data salah)", () => {
    setEnv("NODE_ENV", "development");
    setEnv("ENCRYPTION_KEY", "kunci-sebelum-rotasi".padEnd(32, "x"));
    const encrypted = encryptText("https://airbnb.com/calendar.ics?s=rahasia");

    setEnv("ENCRYPTION_KEY", "kunci-setelah-rotasi".padEnd(32, "y"));
    // decryptText mengembalikan ciphertext apa adanya (tidak melempar) agar UI
    // tidak bocor; dekripsi ketat (decryptTextWithKey) yang melempar error.
    expect(decryptText(encrypted)).toBe(encrypted);
    expect(() => decryptTextWithKey(encrypted, resolveEncryptionKey())).toThrow();
  });

  it("decryptTextWithKey menolak ciphertext dengan format salah", () => {
    const key = deriveEncryptionKey("k".repeat(32));
    expect(() => decryptTextWithKey("bukan-ciphertext", key)).toThrow();
  });

  it("encryptTextWithKey & decryptTextWithKey adalah round-trip yang deterministik", () => {
    const key = deriveEncryptionKey("k".repeat(32));
    const plain = "https://airbnb.com/calendar.ics?s=rahasia";
    const encrypted = encryptTextWithKey(plain, key);

    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptTextWithKey(encrypted, key)).toBe(plain);
  });
});
