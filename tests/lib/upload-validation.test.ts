/**
 * Unit test untuk validasi berkas unggahan (P2-7).
 * Menguji allowlist MIME, magic bytes, dan nama berkas aman.
 */
import { describe, expect, it } from "vitest";
import {
  validateUploadedFile,
  FileValidationError,
  isAllowedExtension,
  sanitizeFileName,
  ALLOWED_MIME_TYPES,
} from "@/lib/upload-validation";

function fakeFile(name: string, type: string): File {
  return new File(["dummy"], name, { type, lastModified: Date.now() }) as unknown as File & {
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
}

function bufferFromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

describe("upload-validation: ekstensi dan nama berkas", () => {
  it("menerima ekstensi yang diizinkan", () => {
    expect(isAllowedExtension("struk.jpg")).toBe(true);
    expect(isAllowedExtension("struk.PDF")).toBe(true);
    expect(isAllowedExtension("struk.jpeg")).toBe(true);
    expect(isAllowedExtension("struk.png")).toBe(true);
    expect(isAllowedExtension("struk.webp")).toBe(true);
  });

  it("menolak ekstensi yang tidak diizinkan", () => {
    expect(isAllowedExtension("struk.exe")).toBe(false);
    expect(isAllowedExtension("struk.csv")).toBe(false);
    expect(isAllowedExtension("struk")).toBe(false);
  });

  it("menghasilkan nama berkas aman", () => {
    const traversal = sanitizeFileName("../../etc/passwd");
    expect(traversal).not.toMatch(/\.\./);
    expect(traversal).not.toMatch(/\//);
    expect(traversal).not.toMatch(/\\/);
    expect(sanitizeFileName("struk normalize.jpg")).toBe("struk_normalize.jpg");
    expect(sanitizeFileName("a".repeat(100) + ".pdf")).toMatch(/\.pdf$/);
    expect(sanitizeFileName("a".repeat(100) + ".pdf").length).toBeLessThanOrEqual(64);
  });
});

describe("upload-validation: magic bytes & MIME", () => {
  it("menerima JPEG dengan magic bytes valid", () => {
    const buf = bufferFromHex("ffd8ffe000104a464946");
    const file = fakeFile("struk.jpg", "image/jpeg");
    const result = validateUploadedFile(file, buf);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.safeName).toBe("struk.jpg");
    expect(result.size).toBe(buf.length);
    expect(result.sha256).toHaveLength(64);
  });

  it("menerima PNG dengan magic bytes valid", () => {
    const buf = bufferFromHex("89504e470d0a1a0a");
    const file = fakeFile("struk.png", "image/png");
    const result = validateUploadedFile(file, buf);
    expect(result.mimeType).toBe("image/png");
  });

  it("menerima WEBP dengan magic bytes valid", () => {
    const buf = bufferFromHex("524946462c00000057454250");
    const file = fakeFile("struk.webp", "image/webp");
    const result = validateUploadedFile(file, buf);
    expect(result.mimeType).toBe("image/webp");
  });

  it("menerima PDF dengan magic bytes valid", () => {
    const buf = bufferFromHex("255044462d31");
    const file = fakeFile("struk.pdf", "application/pdf");
    const result = validateUploadedFile(file, buf);
    expect(result.mimeType).toBe("application/pdf");
  });

  it("menolak berkas kosong", () => {
    const buf = Buffer.alloc(0);
    const file = fakeFile("empty.jpg", "image/jpeg");
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
    expect(() => validateUploadedFile(file, buf)).toThrow(/tidak boleh kosong/);
  });

  it("menolak berkas terlalu besar", () => {
    const buf = Buffer.alloc(11 * 1024 * 1024);
    const file = fakeFile("big.jpg", "image/jpeg");
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
    expect(() => validateUploadedFile(file, buf)).toThrow(/melebihi batas/);
  });

  it("menolak magic bytes yang tidak cocok allowlist", () => {
    const buf = Buffer.from("ini bukan gambar atau pdf asli", "utf8");
    const file = fakeFile("struk.jpg", "image/jpeg");
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
    expect(() => validateUploadedFile(file, buf)).toThrow(/tidak dikenali atau bukan format/);
  });

  it("menolak ekstensi yang tidak diizinkan meski magic bytes JPEG", () => {
    const buf = bufferFromHex("ffd8ffe0");
    const file = fakeFile("struk.exe", "image/jpeg");
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
  });

  it("menolak MIME type klien yang tidak diizinkan", () => {
    const buf = bufferFromHex("ffd8ffe0");
    const file = fakeFile("struk.jpg", "application/x-executable");
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
    expect(() => validateUploadedFile(file, buf)).toThrow(/Tipe MIME/);
  });

  it("menolak MIME type klien yang tidak konsisten dengan magic bytes", () => {
    const buf = bufferFromHex("ffd8ffe0"); // JPEG magic
    const file = fakeFile("struk.png", "image/png"); // klien bilang PNG
    expect(() => validateUploadedFile(file, buf)).toThrow(FileValidationError);
    expect(() => validateUploadedFile(file, buf)).toThrow(/tidak cocok/);
  });
});

describe("upload-validation: daftar MIME yang diizinkan", () => {
  it("mengandung tipe MIME yang diharapkan", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
  });
});
