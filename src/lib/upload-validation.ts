/**
 * Validasi berkas unggahan (P2-7).
 *
 * Memaksa allowlist MIME type, magic bytes (signature file), dan nama berkas
 * yang aman sebelum berkas diterima. MIME type yang dikirim klien (`file.type`)
 * tidak dipercaya sepenuhnya — magic bytes diperiksa dari isi berkasnya sendiri
 * agar berkas berbahaya dengan ekstensi palsu ditolak.
 *
 * Sumber kebenaran: AGENTS.md #9 (rahasia lewat env/secret manager), ADR-038.
 *
 * Format magic bytes yang diizinkan untuk struk pengeluaran:
 *   JPEG   : FF D8 FF
 *   PNG    : 89 50 4E 47
 *   WEBP   : 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
 *   PDF    : 25 50 44 46 (%PDF)
 */
import { createHash } from "node:crypto";

/** Tipe MIME yang diizinkan untuk berkas struk. */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/** Ekstensi berkas yang diizinkan (dipadu dengan validasi magic bytes). */
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"] as const;

/** Ukuran maksimal berkas (10 MB). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Hasil validasi berkas. */
export interface ValidatedFile {
  /** Nama berkas yang sudah disaring (safe). */
  safeName: string;
  /** Tipe MIME yang terdeteksi dari magic bytes. */
  mimeType: string;
  /** Ukuran berkas dalam byte. */
  size: number;
  /** SHA-256 dari isi berkas. */
  sha256: string;
}

/** Galat validasi berkas. */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/**
 * Ekstrak magic bytes (beberapa byte pertama) dari buffer.
 */
function readMagicBytes(buffer: Buffer, length = 16): Buffer {
  return buffer.subarray(0, Math.min(length, buffer.length));
}

/**
 * Deteksi tipe MIME dari magic bytes buffer.
 * Mengembalikan null bila tidak cocok dengan allowlist.
 */
function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  const magic = readMagicBytes(buffer);

  // JPEG: FF D8 FF
  if (magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47) {
    return "image/png";
  }

  // WEBP: RIFF .... WEBP (byte 0-3 = RIFF, byte 8-11 = WEBP)
  if (
    magic.length >= 12 &&
    magic[0] === 0x52 &&
    magic[1] === 0x49 &&
    magic[2] === 0x46 &&
    magic[3] === 0x46 &&
    magic[8] === 0x57 &&
    magic[9] === 0x45 &&
    magic[10] === 0x42 &&
    magic[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF: %PDF (25 50 44 46)
  if (magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) {
    return "application/pdf";
  }

  return null;
}

/**
 * Periksa apakah ekstensi berkas diizinkan.
 */
export function isAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Hasilkan nama berkas yang aman: hapus karakter berbahaya, batasi panjang,
 * dan pastikan ekstensi ada di allowlist.
 */
export function sanitizeFileName(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\._+/g, ".");
  const parts = base.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : "";
  const name = parts.join("_").slice(0, 60) || "file";
  return `${name}${ext}`;
}

/**
 * Validasi berkas lengkap: ukuran, ekstensi, MIME type (klien), dan magic bytes
 * (isi berkas). Mengembalikan objek ValidatedFile bila lolos.
 */
export function validateUploadedFile(file: File, buffer: Buffer): ValidatedFile {
  // 1. Ukuran
  if (buffer.length === 0) {
    throw new FileValidationError("Berkas tidak boleh kosong.");
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `Ukuran berkas melebihi batas ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)} MB.`,
    );
  }

  // 2. Ekstensi nama berkas
  if (!isAllowedExtension(file.name)) {
    throw new FileValidationError(
      `Ekstensi berkas tidak diizinkan. Yang diizinkan: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    );
  }

  // 3. MIME type dari klien harus ada di allowlist (jaga-jaga lapis pertama)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new FileValidationError(`Tipe MIME "${file.type}" tidak diizinkan.`);
  }

  // 4. Magic bytes dari isi berkas (sumber kebenaran)
  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (!detectedMime) {
    throw new FileValidationError(
      "Isi berkas tidak dikenali atau bukan format struk yang diizinkan (JPEG/PNG/WEBP/PDF).",
    );
  }

  // 5. MIME type klien harus konsisten dengan magic bytes bila dikirim
  if (file.type && file.type !== detectedMime) {
    throw new FileValidationError(
      `Tipe MIME berkas (${file.type}) tidak cocok dengan isi berkas (${detectedMime}).`,
    );
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    safeName: sanitizeFileName(file.name),
    mimeType: detectedMime,
    size: buffer.length,
    sha256,
  };
}
