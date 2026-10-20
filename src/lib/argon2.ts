/**
 * Wrapper argon2id untuk hashing password.
 * Sumber kebenaran: docs/08-quality-security-ops.md §3 (autentikasi).
 *
 * Catatan produksi:
 * - Parameter berasal dari rekomendasi OWASP Password Storage Cheat Sheet
 *   (memori 19 MiB, iterasi 2, parallelism 1). Dipakai sebagai default
 *   yang aman di server umum tanpa membuat login tertunda lebih dari
 *   ~250 md pada VPS kelas menengah.
 * - Modul ini server-only (Node.js). Jangan dipanggil dari komponen
 *   klien; hashing di klien akan membocorkan parameter ke publik.
 *
 * Verifikasi menggunakan constant-time compare yang disediakan pustaka
 * (@node-rs/argon2) sehingga tahan terhadap timing attack.
 */
import { hash, verify } from "@node-rs/argon2";

/**
 * Parameter hashing.
 *
 * Catatan: `@node-rs/argon2` mengekspor `Algorithm` sebagai `const enum`
 * yang tidak dapat diakses saat `isolatedModules` aktif. Karena itu
 * kita pakai literal numerik yang setara (`Algorithm.Argon2id === 2`).
 */
export const ARGON2_PARAMS = {
  // 2 = Argon2id (lihat enum Algorithm @node-rs/argon2)
  algorithm: 2 as const,
  memoryCost: 19456, // 19 MiB (>= 19 MiB sesuai rekomendasi OWASP)
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hashing argon2id mengembalikan string self-contained yang sudah
 * mencakup salt, hash, dan parameter. Cukup untuk verifikasi.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("Password harus string tidak kosong");
  }
  return hash(plain, ARGON2_PARAMS);
}

/**
 * Verifikasi argon2id. Selalu return boolean; tangkap exception internal
 * agar tidak bocor ke klien.
 */
export async function verifyPassword(hashStored: string, plain: string): Promise<boolean> {
  if (typeof hashStored !== "string" || hashStored.length === 0) return false;
  if (typeof plain !== "string" || plain.length === 0) return false;
  try {
    return await verify(hashStored, plain);
  } catch {
    return false;
  }
}
