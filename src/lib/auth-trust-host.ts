/**
 * Kebijakan `trustHost` Auth.js v5 (Pure helper, tanpa I/O).
 *
 * Latar belakang: Auth.js v5 melempar `UntrustedHost` bila `trustHost` false,
 * karena ia tidak lagi mempercayai header `Host` secara default di produksi
 * (`@auth/core` env.js: `trustHost ??= !!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL
 * ?? CF_PAGES ?? NODE_ENV !== "production")`). Tanpa konfigurasi, seluruh
 * login produksi gagal dengan 500.
 *
 * Dua cara aman menyalakannya:
 * 1. `AUTH_URL=https://domain-resmi` — Auth.js memakai URL kanonis ini
 *    (bukan header Host) untuk semua redirect. **Pilihan utama.**
 * 2. `AUTH_TRUST_HOST=true` — hanya bila reverse proxy/platformDijamin
 *    menulis header `Host` yang benar (mis. Vercel/Cloudflare).
 *
 * Di produksi, bila keduanya tidak diset → boot gagal (lihat `src/lib/env.ts`),
 * bukan menunggu error 500 saat user tries login.
 *
 * Referensi: docs/08-quality-security-ops.md §3, ADR-032.
 */

export interface TrustHostInput {
  /** URL kanonis aplikasi (AUTH_URL). */
  authUrl?: string | null;
  /** Flag trust host (AUTH_TRUST_HOST) — "true"/"false". */
  authTrustHost?: string | null;
  /** Environment aplikasi (NODE_ENV). */
  nodeEnv?: string | null;
}

export type TrustHostReason = "auth-url" | "explicit-trust-host" | "non-production" | "untrusted";

export interface TrustHostDecision {
  /** Nilai yang harus dipasang pada `trustHost` milik Auth.js. */
  trustHost: boolean;
  /** Alasan keputusan (untuk log/diagnostik). */
  reason: TrustHostReason;
  /** URL kanonis yang dipakai Auth.js untuk semua action URL (bila ada). */
  canonicalUrl: string | null;
}

/**
 * Tentukan apakah host request boleh dipercaya oleh Auth.js.
 *
 * - `AUTH_URL` diset → `true` (URL kanonis dipakai, bukan Host header).
 * - `AUTH_TRUST_HOST=true` → `true` (proxy dipercaya men-set Host).
 * - Di luar produksi → `true` (fasilitas development Auth.js).
 * - Selain itu (produksi tanpa konfigurasi) → `false`.
 */
export function resolveTrustHost(input: TrustHostInput): TrustHostDecision {
  const authUrl = input.authUrl?.trim();
  if (authUrl) {
    try {
      const url = new URL(authUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return { trustHost: true, reason: "auth-url", canonicalUrl: url.origin };
      }
    } catch {
      // URL tidak valid → abaikan, lanjut ke aturan berikutnya.
    }
  }

  const flag = input.authTrustHost?.trim().toLowerCase();
  if (flag === "true") {
    return { trustHost: true, reason: "explicit-trust-host", canonicalUrl: null };
  }

  const nodeEnv = input.nodeEnv?.trim();
  if (nodeEnv && nodeEnv !== "production") {
    return { trustHost: true, reason: "non-production", canonicalUrl: null };
  }

  return { trustHost: false, reason: "untrusted", canonicalUrl: null };
}

/**
 * Apakah konfigurasi produksi memenuhi syarat `trustHost`.
 * Dipakai oleh validasi environment saat boot.
 */
export function hasValidProductionTrustHost(input: TrustHostInput): boolean {
  const decision = resolveTrustHost(input);
  return (
    decision.trustHost &&
    (decision.reason === "auth-url" || decision.reason === "explicit-trust-host")
  );
}
