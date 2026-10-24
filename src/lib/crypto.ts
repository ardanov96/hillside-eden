/**
 * Utilitas Enkripsi & Dekripsi Simetris (AES-256-GCM) untuk Data Sensitif (OD-09 / S9-02).
 *
 * Digunakan untuk mengamankan URL feed iCal yang memuat token/kunci akses rahasia
 * pada tabel IcalFeed (urlEncrypted), sesuai aturan AGENTS.md #9.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV standar untuk GCM

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    "hillside-eden-dev-fallback-encryption-key-32b";
  return createHash("sha256").update(secret).digest();
}

/**
 * Enkripsi teks menjadi format string terautentikasi:
 *   ivHex:authTagHex:encryptedHex
 */
export function encryptText(plainText: string): string {
  if (!plainText) return "";
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Dekripsi string hasil encryptText. Jika format bukan cipher valid atau
 * teks polos, mengembalikan teks apa adanya secara aman.
 */
export function decryptText(cipherText: string): string {
  if (!cipherText) return "";

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // Kemungkinan URL legacy atau teks polos
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    return cipherText;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
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
