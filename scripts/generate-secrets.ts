#!/usr/bin/env tsx
/**
 * Generator secret aplikasi (ADR-033).
 *
 * Mengisi variabel yang belum ada di file `.env` dengan nilai acak yang kuat
 * (crypto random), tanpa mencetak nilainya. Tujuannya: monolithic repo ini
 * tidak boleh punya secret kosong/placeholder yang bisa lolos ke produksi
 * (AGENTS.md #9).
 *
 * Cara pakai:
 *   pnpm secrets:generate            # isi secret yang belum ada di .env
 *   pnpm secrets:generate --force    # regenerasi semua secret terkelola
 *   pnpm secrets:generate --show     # tampilkan nilai (hanya di mesin dev)
 *   pnpm secrets:generate --file=.env.local
 *
 * Aturan:
 * - Secret yang **sudah ada dan Seems valid** tidak ditimpa (kecuali `--force`).
 * - Nilai placeholder (mis. "ganti-dengan-...", "TODO", "CHANGE_ME") dianggap
 *   tidak valid → digenerate ulang.
 * - Nilai rahasia tidak pernah dicetak kecuali `--show`.
 * - `.env` tidak pernah di-commit (sudah di-gitignore).
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface SecretSpec {
  /** Nama variabel environment. */
  key: string;
  /** Panjang minimum karakter nilai. */
  minLength: number;
  /** Jumlah byte acak yang dipakai. */
  bytes: number;
  /** Encoding nilai. */
  encoding: "hex" | "base64url";
  /** Keterangan singkat (dicetak di laporan). */
  description: string;
}

/**
 * Daftar secret yang dikelola skrip ini.
 *
 * - `AUTH_SECRET` : kunci penanda tangan cookie sesi Auth.js.
 * - `ENCRYPTION_KEY` : kunci AES-256-GCM untuk URL iCal (ADR-031).
 * - `DIRECT_BOOKING_WEBHOOK_SECRET` / `INBOUND_EMAIL_WEBHOOK_SECRET` :
 *   secret autentikasi webhook (minimal 16 karakter, ADR-030).
 * - `OTA_VAULT_KEY` : kunci enkripsi vault kredensial OTA lokal (ADR-034).
 */
export const SECRET_SPECS: readonly SecretSpec[] = [
  {
    key: "AUTH_SECRET",
    minLength: 32,
    bytes: 32,
    encoding: "base64url",
    description: "Kunci penanda tangan cookie sesi Auth.js",
  },
  {
    key: "ENCRYPTION_KEY",
    minLength: 32,
    bytes: 32,
    encoding: "hex",
    description: "Kunci enkripsi URL iCal (AES-256-GCM)",
  },
  {
    key: "DIRECT_BOOKING_WEBHOOK_SECRET",
    minLength: 16,
    bytes: 32,
    encoding: "base64url",
    description: "Secret autentikasi webhook direct booking",
  },
  {
    key: "INBOUND_EMAIL_WEBHOOK_SECRET",
    minLength: 16,
    bytes: 32,
    encoding: "base64url",
    description: "Secret autentikasi webhook email masuk",
  },
  {
    key: "OTA_VAULT_KEY",
    minLength: 32,
    bytes: 32,
    encoding: "hex",
    description: "Kunci enkripsi vault kredensial OTA lokal",
  },
];

/** Pola nilai yang dianggap placeholder (belum layak dipakai). */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /ganti[-_ ]?dengan/i,
  /isi[-_ ]?dengan/i,
  /placeholder/i,
  /change[-_ ]?me/i,
  /todo/i,
  /example/i,
  /^x{4,}/i,
  /^<.*>$/,
];

export type SecretActionReason = "missing" | "placeholder" | "forced" | "kept";

export interface SecretAction {
  key: string;
  reason: SecretActionReason;
  /** Nilai baru (hanya diisi bila reason bukan "kept"). */
  value?: string;
  description: string;
}

/** Apakah nilai ini terlihat seperti placeholder? */
export function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Ambil nilai aktif (baris tidak dikomentari) sebuah variabel.
 * Mengembalikan `null` bila variabel tidak ada atau kosong.
 */
export function findActiveValue(content: string, key: string): string | null {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`);
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    const match = pattern.exec(line);
    if (!match) continue;
    const raw = (match[1] ?? "").trim();
    if (raw.length === 0) return null;
    // Lepas tanda kutip bila ada.
    const unquoted = raw.replace(/^["'](.*)["']$/, "$1").trim();
    return unquoted.length > 0 ? unquoted : null;
  }
  return null;
}

/** Buat nilai acak yang kuat untuk sebuah spesifikasi secret. */
export function generateSecretValue(spec: SecretSpec): string {
  const raw = randomBytes(spec.bytes);
  const value = spec.encoding === "hex" ? raw.toString("hex") : raw.toString("base64url");
  if (value.length < spec.minLength) {
    // base64url dari 16 byte = 22 karakter; bytes di specs sudah jauh melewati
    // minimum, guard ini hanya jaga-jaga bila spec berubah.
    throw new Error(
      `Nilai acak untuk ${spec.key} terlalu pendek (${value.length} < ${spec.minLength}).`,
    );
  }
  return value;
}

/**
 * Susun rencana pengisian secret pada isi file env.
 * Fungsi murni: tidak menyentuh disk, mudah diuji.
 */
export function planSecretGeneration(
  content: string,
  specs: readonly SecretSpec[] = SECRET_SPECS,
  options: { force?: boolean } = {},
): { actions: SecretAction[]; updatedContent: string } {
  const actions: SecretAction[] = [];
  let updatedContent = content;

  for (const spec of specs) {
    const existing = findActiveValue(updatedContent, spec.key);
    const placeholder = existing !== null && isPlaceholderValue(existing);

    if (existing !== null && !placeholder && !options.force) {
      actions.push({ key: spec.key, reason: "kept", description: spec.description });
      continue;
    }

    const value = generateSecretValue(spec);
    const reason: SecretActionReason = options.force
      ? "forced"
      : existing === null
        ? "missing"
        : "placeholder";

    updatedContent = upsertEnvValue(updatedContent, spec.key, value);
    actions.push({ key: spec.key, reason, value, description: spec.description });
  }

  return { actions, updatedContent };
}

/**
 * Tulis/perbarui variabel pada isi file env tanpa merusak baris lain.
 * Bila variabel sudah ada (aktif), nilainya diganti di tempat.
 */
export function upsertEnvValue(content: string, key: string, value: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  const quoted = `${key}="${value}"`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("#")) continue;
    if (pattern.test(line)) {
      lines[i] = quoted;
      return lines.join(eol);
    }
  }

  // Variabel belum ada → sisipkan di akhir isi (tanpa damaging baris kosong terakhir).
  const trailingNewline = content.endsWith("\n");
  const body = trailingNewline ? lines.slice(0, -1) : lines;
  const result = [...body, quoted].join(eol);
  return trailingNewline ? result + eol : result;
}

/**
 * Susun laporan untuk dicetak. Nilai rahasia **tidak** disertakan kecuali
 * `show` bernilai true.
 */
export function formatReport(actions: readonly SecretAction[], show = false): string[] {
  const lines: string[] = [];
  for (const action of actions) {
    switch (action.reason) {
      case "kept":
        lines.push(`  = ${action.key}: sudah ada (tidak diubah)`);
        break;
      case "missing":
        lines.push(`  + ${action.key}: dibuat (${action.description})`);
        break;
      case "placeholder":
        lines.push(`  ~ ${action.key}: nilai placeholder diganti (${action.description})`);
        break;
      case "forced":
        lines.push(`  * ${action.key}: digenerate ulang (${action.description})`);
        break;
    }
    if (show && action.value) {
      lines.push(`      ${action.key}=${action.value}`);
    }
  }
  return lines;
}

function parseArgs(argv: readonly string[]): {
  file: string;
  force: boolean;
  show: boolean;
} {
  const fileArg = argv.find((a) => a.startsWith("--file="));
  return {
    file: fileArg ? fileArg.slice("--file=".length) : ".env",
    force: argv.includes("--force"),
    show: argv.includes("--show"),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), args.file);

  if (!existsSync(filePath)) {
    console.error(`[secrets] berkas tidak ditemukan: ${filePath}`);
    console.error("[secrets] salin .env.example menjadi .env lalu jalankan ulang.");
    process.exitCode = 1;
    return;
  }

  const original = readFileSync(filePath, "utf8");
  const { actions, updatedContent } = planSecretGeneration(original, SECRET_SPECS, {
    force: args.force,
  });

  const changed = updatedContent !== original;
  if (changed) {
    writeFileSync(filePath, updatedContent, "utf8");
  }

  console.log(`[secrets] berkas: ${args.file}`);
  for (const line of formatReport(actions, args.show)) {
    console.log(line);
  }
  console.log(
    changed
      ? "[secrets] berkas env diperbarui. Jangan commit berkas ini."
      : "[secrets] tidak ada perubahan.",
  );
  if (!args.show) {
    console.log("[secrets] nilai rahasia tidak dicetak (gunakan --show bila perlu).");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("[secrets] gagal:", err);
    process.exitCode = 1;
  }
}
