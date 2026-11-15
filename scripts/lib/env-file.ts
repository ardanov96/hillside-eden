/**
 * Pembaca berkas `.env` sederhana untuk skrip operasional.
 *
 * Aplikasi web (Next.js) sudah memuat `.env` sendiri; skrip yang dijalankan
 * lewat `tsx` tidak, jadi skripsecret/vault memanggil helper ini.
 *
 * Tidak ada dependensi `dotenv` di repo ini, jadi parsing dilakukan manual
 * dengan aturan secukupnya: `KEY=VALUE`, `KEY="VALUE"`, `KEY='VALUE'`,
 * baris kosong dan komentar diabaikan.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Parse isi berkas env menjadi pasangan key → value. */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const separator = line.search(/=/);
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(separator + 1).trim();

    const quoted = value[0];
    if (quoted === '"' || quoted === "'") {
      const end = value.indexOf(quoted, 1);
      value = end > 0 ? value.slice(1, end) : value.slice(1);
    } else {
      // Nilai tanpa kutip: buang komentar di akhir baris.
      const commentIndex = value.indexOf(" #");
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    result[key] = value;
  }

  return result;
}

/**
 * Muat berkas env ke `process.env` **tanpa menimpa** nilai yang sudah ada.
 * Mengembalikan daftar key yang dimuat.
 */
export function loadEnvFile(filePath = ".env", env: NodeJS.ProcessEnv = process.env): string[] {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) return [];

  const parsed = parseEnvFile(readFileSync(resolved, "utf8"));
  const loaded: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) {
      env[key] = value;
      loaded.push(key);
    }
  }

  return loaded;
}
