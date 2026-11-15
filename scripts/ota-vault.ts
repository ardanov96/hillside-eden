#!/usr/bin/env tsx
/**
 * Vault kredensial OTA lokal (ADR-034).
 *
 * Latar belakang: kredensial extranet OTA pernah disimpan plaintext di
 * `akses_OTA.txt` pada mesin pengembang. Berkas itu tidak di-commit, tetapi
 * tetap berarti "secret at rest" tanpa enkripsi.
 *
 * Solusi: kredensial dienkripsi AES-256-GCM dengan kunci `OTA_VAULT_KEY`
 * (isi di `.env`/secret manager) dan disimpan sebagai
 * `secrets/ota-credentials.enc.json` (direktori `secrets/` di-gitignore).
 *
 * CATATAN PENTING:
 * - Vault ini **tidak** mengotomasi login atau scraping OTA. Isinya hanya
 *   dibaca manual oleh pemilik (AGENTS.md #2).
 * - Tidak ada kode aplikasi yang membaca vault ini; formatnya stabil dan
 *   bisa dipindahkan ke secret manager platform tanpa perubahan kode.
 * - Kunci `OTA_VAULT_KEY` harus disimpan juga di secret manager platform
 *   (keputusan secret manager masih OPEN: OD-02/OD-05).
 *
 * Cara pakai:
 *   pnpm secrets:vault status             # metadata + cek dekripsi (tanpa cetak)
 *   pnpm secrets:vault show               # ringkasan tersamar (tanpa password)
 *   pnpm secrets:vault show --reveal      # cetak isi penuh (sensitif)
 *   pnpm secrets:vault encrypt            # enkripsi sumber plaintext
 *   pnpm secrets:vault encrypt --remove-plaintext  # hapus plaintext setelah verifikasi
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decryptTextWithKey, deriveEncryptionKey, encryptTextWithKey } from "../src/lib/crypto";
import { loadEnvFile } from "./lib/env-file";

/** Panjang minimum `OTA_VAULT_KEY` (karakter). */
export const OTA_VAULT_KEY_MIN_LENGTH = 32;

/** Versi format vault. */
export const VAULT_VERSION = 1;

/** Nama berkas vault (relatif terhadap root repo). */
export const DEFAULT_VAULT_PATH = path.join("secrets", "ota-credentials.enc.json");

/** Berkas plaintext sumber (dipakai operator manual). */
export const DEFAULT_SOURCE_PATH = "akses_OTA.txt";

export interface VaultPayload {
  version: number;
  algorithm: string;
  createdAt: string;
  source: string;
  /** Ciphertext berformat `ivHex:authTagHex:dataHex`. */
  ciphertext: string;
}

export interface OtaCredentialEntry {
  url: string;
  user: string;
  pass: string;
}

/** Ambil kunci vault dari environment; melempar error bila tidak valid. */
export function resolveVaultKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const secret = env.OTA_VAULT_KEY?.trim();
  if (!secret) {
    throw new Error(
      "OTA_VAULT_KEY belum di-set. Jalankan `pnpm secrets:generate` atau isi manual di .env.",
    );
  }
  if (secret.length < OTA_VAULT_KEY_MIN_LENGTH) {
    throw new Error(`OTA_VAULT_KEY terlalu pendek (minimal ${OTA_VAULT_KEY_MIN_LENGTH} karakter).`);
  }
  return deriveEncryptionKey(secret);
}

/**
 * Susun payload vault dari plaintext.
 * Fungsi murni — mudah diuji.
 */
export function buildVaultPayload(
  plaintext: string,
  key: Buffer,
  options: { source?: string; createdAt?: string } = {},
): VaultPayload {
  return {
    version: VAULT_VERSION,
    algorithm: "aes-256-gcm",
    createdAt: options.createdAt ?? new Date().toISOString(),
    source: options.source ?? DEFAULT_SOURCE_PATH,
    ciphertext: encryptTextWithKey(plaintext, key),
  };
}

/** Serialisasi payload vault ke JSON (indent 2, trailing newline). */
export function serializeVault(payload: VaultPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Baca & validasi payload vault dari JSON.
 * Melempar error bila format tidak dikenal (fail-closed).
 */
export function parseVault(raw: string): VaultPayload {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Berkas vault bukan JSON yang valid.");
  }

  if (typeof data !== "object" || data === null) {
    throw new Error("Struktur vault tidak dikenal.");
  }

  const payload = data as Partial<VaultPayload>;
  if (payload.version !== VAULT_VERSION) {
    throw new Error(`Versi vault tidak didukung: ${String(payload.version)}.`);
  }
  if (payload.algorithm !== "aes-256-gcm") {
    throw new Error(`Algoritma vault tidak dikenal: ${String(payload.algorithm)}.`);
  }
  if (typeof payload.ciphertext !== "string" || payload.ciphertext.length === 0) {
    throw new Error("Vault tidak memuat ciphertext.");
  }

  return {
    version: payload.version,
    algorithm: payload.algorithm,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : "",
    source: typeof payload.source === "string" ? payload.source : "",
    ciphertext: payload.ciphertext,
  };
}

/** Dekripsi vault; melempar error bila kunci salah atau data rusak. */
export function openVault(payload: VaultPayload, key: Buffer): string {
  return decryptTextWithKey(payload.ciphertext, key);
}

/**
 * Pecah isi plaintext kredensial menjadi blok `{url, user, pass}`.
 * Format berkas: baris `https = ...`, `user = ...`, `pass = ...` per blok.
 */
export function parseOtaCredentialBlocks(text: string): OtaCredentialEntry[] {
  const entries: OtaCredentialEntry[] = [];
  let current: Partial<OtaCredentialEntry> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const separator = line.search(/[:=]/);
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (value.length === 0) continue;

    if (key === "https" || key === "url" || key === "host") {
      if (current.url || current.user || current.pass) {
        entries.push({
          url: current.url ?? "",
          user: current.user ?? "",
          pass: current.pass ?? "",
        });
        current = {};
      }
      current.url = value;
    } else if (key === "user" || key === "username" || key === "login") {
      current.user = value;
    } else if (key === "pass" || key === "password") {
      current.pass = value;
    }
  }

  if (current.url || current.user || current.pass) {
    entries.push({ url: current.url ?? "", user: current.user ?? "", pass: current.pass ?? "" });
  }

  return entries;
}

/** Tampilkan ringkasan yang aman: host & username, password disamarkan. */
export function maskCredentials(text: string): string[] {
  return parseOtaCredentialBlocks(text).map((entry, index) => {
    const host = (() => {
      try {
        const normalized = entry.url.startsWith("//") ? "https:" + entry.url : entry.url;
        return new URL(normalized).host;
      } catch {
        return entry.url ? "(url tidak valid)" : "(kosong)";
      }
    })();
    const user = entry.user ? entry.user : "(kosong)";
    const pass = entry.pass ? "********" : "(kosong)";
    return `  ${index + 1}. host=${host} user=${user} pass=${pass}`;
  });
}

function parseArgs(argv: readonly string[]): {
  command: string;
  vaultPath: string;
  sourcePath: string;
  reveal: boolean;
  removePlaintext: boolean;
} {
  const command = argv[0] ?? "status";
  const vaultArg = argv.find((a) => a.startsWith("--vault="));
  const sourceArg = argv.find((a) => a.startsWith("--source="));
  return {
    command,
    vaultPath: vaultArg ? vaultArg.slice("--vault=".length) : DEFAULT_VAULT_PATH,
    sourcePath: sourceArg ? sourceArg.slice("--source=".length) : DEFAULT_SOURCE_PATH,
    reveal: argv.includes("--reveal"),
    removePlaintext: argv.includes("--remove-plaintext"),
  };
}

function commandStatus(vaultPath: string): void {
  if (!existsSync(vaultPath)) {
    console.log(`[vault] belum ada vault di ${vaultPath}`);
    console.log("[vault] buat dengan: pnpm secrets:vault encrypt");
    return;
  }

  const payload = parseVault(readFileSync(vaultPath, "utf8"));
  console.log(`[vault] berkas   : ${vaultPath}`);
  console.log(`[vault] versi    : ${payload.version} (${payload.algorithm})`);
  console.log(`[vault] dibuat   : ${payload.createdAt}`);
  console.log(`[vault] sumber   : ${payload.source}`);

  try {
    const key = resolveVaultKey();
    const plaintext = openVault(payload, key);
    const entries = parseOtaCredentialBlocks(plaintext);
    console.log(`[vault] dekripsi  : BERHASIL (${entries.length} blok kredensial)`);
    console.log("[vault] isi tidak dicetak; pakai `show` untuk ringkasan tersamar.");
  } catch (err) {
    console.error(`[vault] dekripsi  : GAGAL — ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

function commandShow(vaultPath: string, reveal: boolean): void {
  if (!existsSync(vaultPath)) {
    console.error(`[vault] belum ada vault di ${vaultPath}`);
    process.exitCode = 1;
    return;
  }

  const payload = parseVault(readFileSync(vaultPath, "utf8"));
  const key = resolveVaultKey();
  const plaintext = openVault(payload, key);

  if (reveal) {
    console.warn("[vault] PERINGATAN: isi sensitif akan dicetak ke terminal/riwayat.");
    console.log(plaintext);
    return;
  }

  console.log("[vault] ringkasan (password disamarkan):");
  for (const line of maskCredentials(plaintext)) {
    console.log(line);
  }
}

function commandEncrypt(vaultPath: string, sourcePath: string, removePlaintext: boolean): void {
  if (!existsSync(sourcePath)) {
    console.error(`[vault] sumber tidak ditemukan: ${sourcePath}`);
    process.exitCode = 1;
    return;
  }

  const key = resolveVaultKey();
  const plaintext = readFileSync(sourcePath, "utf8");
  const payload = buildVaultPayload(plaintext, key, { source: path.basename(sourcePath) });

  // Verifikasi sebelum menulis: hasil dekripsi harus identik dengan sumber.
  const verified = openVault(payload, key);
  if (verified !== plaintext) {
    console.error(
      "[vault] VERIFIKASI GAGAL: hasil dekripsi berbeda dari sumber. Vault tidak ditulis.",
    );
    process.exitCode = 1;
    return;
  }

  const targetPath = path.resolve(process.cwd(), vaultPath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, serializeVault(payload), "utf8");

  // Verifikasi ulang dari disk.
  const reread = parseVault(readFileSync(targetPath, "utf8"));
  if (openVault(reread, key) !== plaintext) {
    console.error("[vault] VERIFIKASI GAGAL: vault di disk tidak terbaca utuh.");
    process.exitCode = 1;
    return;
  }

  console.log(`[vault] terenkripsi: ${vaultPath}`);
  console.log(`[vault] algoritma   : ${payload.algorithm} (AES-256-GCM)`);
  console.log(`[vault] sumber      : ${sourcePath} (${plaintext.length} karakter)`);
  console.log("[vault] verifikasi   : OK (dekripsi identik dengan sumber)");

  if (removePlaintext) {
    // Kosongkan dulu ( shredded tidak dijamin di SSD ), lalu hapus berkasnya.
    writeFileSync(sourcePath, "", "utf8");
    unlinkSync(sourcePath);
    console.log(`[vault] plaintext dihapus: ${sourcePath}`);
  } else {
    console.log(
      "[vault] plaintext sumber masih ada. Hapus manual bila sudah yakin, " +
        "atau jalankan ulang dengan --remove-plaintext.",
    );
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // Skrip dijalankan lewat tsx (bukan Next.js) → muat .env sendiri.
  loadEnvFile(".env");

  switch (args.command) {
    case "status":
      commandStatus(args.vaultPath);
      break;
    case "show":
      commandShow(args.vaultPath, args.reveal);
      break;
    case "encrypt":
      commandEncrypt(args.vaultPath, args.sourcePath, args.removePlaintext);
      break;
    default:
      console.error(`[vault] perintah tidak dikenal: ${args.command}`);
      console.error("[vault] perintah: status | show | encrypt");
      process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("[vault] gagal:", (err as Error).message);
    process.exitCode = 1;
  }
}
