/**
 * Utilitas Enkripsi & Dekripsi Simetris (AES-256-GCM) untuk Data Sensitif (OD-09 / S9-02).
 *
 * Digunakan untuk mengamankan URL feed iCal yang memuat token/kunci akses rahasia
 * pada tabel IcalFeed (urlEncrypted), sesuai aturan AGENTS.md #9.
 *
 * Aturan kunci (ADR-031):
 * - **Produksi**: `ENCRYPTION_KEY` WAJIB ada (minimal 32 karakter). Tidak ada
 *   fallback ke `AUTH_SECRET` dan tidak ada kunci literal yang tercetak di repo.
 * - **Dev/test**: boleh diturunkan dari `AUTH_SECRET` (dijamin ada oleh
 *   `src/lib/env.ts`), sehinggaenkripsi tetap konsisten antar proses.
 * - Kunci yang salah/missing harus menggagalkan operasi (fail-closed), bukan
 *   diam-diam menulis data yang tidak terenkripsi.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
// Impor env untuk efek samping: memastikan placeholder AUTH_SECRET di dev tersedia
// sebelum kunci enkripsi diturunkan. Validasi penuh dilakukan saat boot
// (src/instrumentation.node.ts) dan oleh worker.
import "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV standar untuk GCM

/** Panjang minimum `ENCRYPTION_KEY` (karakter). */
export const ENCRYPTION_KEY_MIN_LENGTH = 32;

/**
 * Turunkan kunci AES-256 (32 byte) dari secret mentah.
 * Deterministik: secret yang sama → kunci yang sama.
 */
export function deriveEncryptionKey(secret: string): Buffer {
  if (!secret || secret.length === 0) {
    throw new Error("Secret enkripsi tidak boleh kosong.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Ambil kunci enkripsi aktif dari environment.
 *
 * - `ENCRYPTION_KEY` (wajib di produksi, minimal 32 karakter) selalu dipakai
 *   lebih dulu.
 * - Hanya di luar produksi, `AUTH_SECRET` boleh dipakai sebagai sumber turunan.
 * - Bila tidak ada sama sekali → throw (jangan pernah memakai kunci default).
 */
export function resolveEncryptionKey(): Buffer {
  const explicit = process.env.ENCRYPTION_KEY?.trim();
  if (explicit) {
    if (explicit.length < ENCRYPTION_KEY_MIN_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY terlalu pendek (minimal ${ENCRYPTION_KEY_MIN_LENGTH} karakter). ` +
          "Lihat docs/08-quality-security-ops.md §6.",
      );
    }
    return deriveEncryptionKey(explicit);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY wajib di-set di produksi (minimal 32 karakter) untuk enkripsi URL iCal. " +
        "Lihat docs/08-quality-security-ops.md §6.",
    );
  }

  const devSecret = process.env.AUTH_SECRET?.trim();
  if (!devSecret) {
    throw new Error(
      "ENCRYPTION_KEY wajib diset (produksi) atau AUTH_SECRET (dev/test) agar enkripsi berjalan.",
    );
  }
  return deriveEncryptionKey(devSecret);
}

/**
 * Enkripsi teks dengan kunci tertentu menjadi format:
 *   ivHex:authTagHex:encryptedHex
 */
export function encryptTextWithKey(plainText: string, key: Buffer): string {
  if (!plainText) return "";
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Dekripsi string dengan kunci tertentu.
 * Berbeda dengan `decryptText`, fungsi ini **ketat**: ciphertext rusak atau
 * kunci salah akan melempar error (dipakai skrip rotasi agar data rusak tidak
 * diam-diam ditulis ulang).
 */
export function decryptTextWithKey(cipherText: string, key: Buffer): string {
  if (!cipherText) return "";

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Format ciphertext tidak valid (harus iv:authTag:data hex).");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Format ciphertext tidak valid (komponen iv:authTag:data kosong).");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Enkripsi teks dengan kunci aktif (lihat `resolveEncryptionKey`).
 * Format string terautentikasi: `ivHex:authTagHex:encryptedHex`.
 */
export function encryptText(plainText: string): string {
  if (!plainText) return "";
  return encryptTextWithKey(plainText, resolveEncryptionKey());
}

/**
 * Dekripsi string hasil encryptText. Jika format bukan cipher valid atau
 * teks polos, mengembalikan teks apa adanya secara aman.
 *
 * Catatan: error konfigurasi kunci (tidak ada ENCRYPTION_KEY di produksi)
 * tetap dilempar — hanya kegagalan dekripsi data yang disamarkan.
 */
export function decryptText(cipherText: string): string {
  if (!cipherText) return "";

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // Kemungkinan URL legacy atau teks polos
    return cipherText;
  }

  // Di luar try: kunci yang tidak terkonfigurasi adalah error fatal.
  const key = resolveEncryptionKey();

  try {
    return decryptTextWithKey(cipherText, key);
  } catch {
    // Jika kunci berubah atau korup, kembalikan teks asli atau string kosong
    return cipherText;
  }
}

/**
 * Sensor URL rahasia untuk tampilan UI (menyamarkan query string / secret key).
 * Contoh:
 *   https://airbnb.com/calendar/ical/1234.ics?s=abcdef12345
 *   -> https://airbnb.com/calendar/ical/1234.ics?s=***
 */
export function maskIcalUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    if (url.search) {
      for (const key of Array.from(url.searchParams.keys())) {
        url.searchParams.set(key, "***");
      }
    }
    return url.toString();
  } catch {
    // Jika bukan URL standar, potong sebagian
    if (rawUrl.length <= 20) return "***";
    return `${rawUrl.slice(0, 15)}...***`;
  }
}
