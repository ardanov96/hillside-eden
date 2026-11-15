/**
 * Unit test vault kredensial OTA (scripts/ota-vault.ts) dan pembaca env
 * (scripts/lib/env-file.ts).
 *
 * Yang diuji (fungsi murni, tanpa akses disk):
 * - enkripsi/dekripsi vault (round-trip), fail-closed saat kunci salah/rusak,
 * - parsing blok kredensial + penyamaran password,
 * - pembacaan berkas `.env` (kutip, komentar, don't override).
 */
import { describe, expect, it } from "vitest";
import { deriveEncryptionKey } from "@/lib/crypto";
import {
  buildVaultPayload,
  maskCredentials,
  openVault,
  parseOtaCredentialBlocks,
  parseVault,
  resolveVaultKey,
  serializeVault,
  VAULT_VERSION,
} from "../../scripts/ota-vault";
import { parseEnvFile } from "../../scripts/lib/env-file";

const KEY = deriveEncryptionKey("kunci-vault-uji-minimal-32-karakter-panjang");
const OTHER_KEY = deriveEncryptionKey("kunci-vault-lain-minimal-32-karakter-panjang");

const SAMPLE = [
  "https = https://www.airbnb.com/hosting/reservations",
  "user = host-manager-1@example.com",
  "pass = password123",
  "",
  "https = https://partner.booking.com/",
  "user = partner-2@example.com",
  "pass = secret456",
  "",
].join("\n");

describe("vault OTA: enkripsi & dekripsi", () => {
  it("round-trip: dekripsi identik dengan sumber", () => {
    const payload = buildVaultPayload(SAMPLE, KEY, { source: "akses_OTA.txt" });
    expect(openVault(payload, KEY)).toBe(SAMPLE);
  });

  it("menyimpan metadata vault (versi, algoritma, sumber)", () => {
    const payload = buildVaultPayload(SAMPLE, KEY, {
      source: "akses_OTA.txt",
      createdAt: "2026-11-15T00:00:00.000Z",
    });

    expect(payload.version).toBe(VAULT_VERSION);
    expect(payload.algorithm).toBe("aes-256-gcm");
    expect(payload.source).toBe("akses_OTA.txt");
    expect(payload.createdAt).toBe("2026-11-15T00:00:00.000Z");
    expect(payload.ciphertext).not.toContain("password123");
  });

  it("gagal membuka vault dengan kunci yang salah (fail-closed)", () => {
    const payload = buildVaultPayload(SAMPLE, KEY);
    expect(() => openVault(payload, OTHER_KEY)).toThrow();
  });

  it("menolak vault yang rusak/tampered", () => {
    const payload = buildVaultPayload(SAMPLE, KEY);
    const tampered = { ...payload, ciphertext: payload.ciphertext.replace(/.$/, "0") };
    expect(() => openVault(tampered, KEY)).toThrow();
  });

  it("serialize lalu parse kembali menghasilkan isi yang sama", () => {
    const payload = buildVaultPayload(SAMPLE, KEY);
    const parsed = parseVault(serializeVault(payload));

    expect(parsed.version).toBe(VAULT_VERSION);
    expect(parsed.algorithm).toBe("aes-256-gcm");
    expect(openVault(parsed, KEY)).toBe(SAMPLE);
  });

  it("menolak JSON rusak atau versi tak dikenal", () => {
    expect(() => parseVault("bukan json")).toThrow();
    expect(() => parseVault(JSON.stringify({ version: 99 }))).toThrow();
    expect(() => parseVault(JSON.stringify({ version: 1, algorithm: "aes-256-gcm" }))).toThrow();
  });
});

describe("vault OTA: parsing kredensial", () => {
  it("memecah blok https/user/pass", () => {
    const entries = parseOtaCredentialBlocks(SAMPLE);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      url: "https://www.airbnb.com/hosting/reservations",
      user: "host-manager-1@example.com",
      pass: "password123",
    });
    expect(entries[1]?.pass).toBe("secret456");
  });

  it("menyamarkan password pada ringkasan", () => {
    const masked = maskCredentials(SAMPLE).join("\n");

    expect(masked).toContain("host=www.airbnb.com");
    expect(masked).toContain("user=host-manager-1@example.com");
    expect(masked).not.toContain("password123");
    expect(masked).not.toContain("secret456");
  });

  it("menangani berkas tanpa pasangan lengkap", () => {
    const entries = parseOtaCredentialBlocks("https = https://contoh.test\n");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.user).toBe("");
    expect(entries[0]?.pass).toBe("");
  });
});

describe("vault OTA: kunci", () => {
  it("menolak kunci yang tidak ada", () => {
    expect(() => resolveVaultKey({} as unknown as NodeJS.ProcessEnv)).toThrow(/OTA_VAULT_KEY/);
  });

  it("menolak kunci yang terlalu pendek", () => {
    expect(() =>
      resolveVaultKey({ OTA_VAULT_KEY: "pendek" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/terlalu pendek/);
  });

  it("menerima kunci yang cukup panjang", () => {
    const key = resolveVaultKey({ OTA_VAULT_KEY: "k".repeat(32) } as unknown as NodeJS.ProcessEnv);
    expect(key).toHaveLength(32);
  });
});

describe("pembaca berkas .env", () => {
  it("membaca nilai berkutip dan tanpa kutip", () => {
    const parsed = parseEnvFile(
      ['A="nilai"', "B=nilai2", "C='nilai3'", "# komentar", "", "D=ada # komentar"].join("\n"),
    );

    expect(parsed.A).toBe("nilai");
    expect(parsed.B).toBe("nilai2");
    expect(parsed.C).toBe("nilai3");
    expect(parsed.D).toBe("ada");
  });

  it("mengabaikan baris komentar dan variabel tak valid", () => {
    const parsed = parseEnvFile(["# KEY=abc", "not-a-key=1", "1BAD=2"].join("\n"));

    expect(parsed.KEY).toBeUndefined();
    expect(parsed["not-a-key"]).toBeUndefined();
    expect(Object.keys(parsed)).toHaveLength(0);
  });
});
