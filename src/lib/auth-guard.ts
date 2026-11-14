/**
 * Kebijakan otorisasi lapisan proxy (Next.js 16 "Proxy", dahulunya middleware).
 *
 * Modul ini SENGAJA murni (tanpa I/O, tanpa import Next.js) supaya aturan
 * "path mana yang boleh lewat tanpa sesi" dapat diuji langsung.
 *
 * Sources of truth:
 * - docs/08-quality-security-ops.md §3 ("semua route dan server action
 *   memeriksa sesi dan `organization_id`").
 * - src/lib/auth-paths.ts: daftar path publik.
 *
 * CATATAN PENTANG (regresi yang pernah terjadi):
 * `next-auth` mengabaikan nilai `false` dari `callbacks.authorized` bila
 * sebuah user-callback disuplai (`auth(() => {})`) — lihat
 * node_modules/next-auth/lib/index.js:163-170. Akibatnya proxy menjadi
 * no-op dan SELURUH route terbuka untuk publik. Karena itu proxy ini
 * TIDAK memakai user-callback; seluruh keputusan diambil dari
 * `callbacks.authorized` (src/auth.config.ts).
 */
import { isPublicPath } from "./auth-paths";

/** Hasil keputusan otorisasi untuk satu request. */
export type ProxyAuthDecision =
  /** Request boleh diteruskan (path publik atau sesi valid). */
  | { kind: "allow" }
  /** Request API tanpa sesi → balas 401 JSON (bukan redirect). */
  | { kind: "unauthorized" }
  /** Request halaman tanpa sesi → redirect ke halaman login. */
  | { kind: "redirect"; callbackUrl: string };

export interface ProxyAuthInput {
  /** Pathname request tanpa query string, mis. "/bookings". */
  pathname: string;
  /** Query string request (opsional), mis. "?period=this_month". */
  search?: string;
  /** True bila request membawa sesi yang valid. */
  hasSession: boolean;
}

/**
 * Tentukan boleh/tidaknya request lolos tanpa handler tambahan.
 *
 * Aturan:
 * 1. Path publik (login, health check, endpoint Auth.js) → allow.
 * 2. Punya sesi valid → allow.
 * 3. Path API tanpa sesi → unauthorized (401 JSON).
 * 4. Path halaman tanpa sesi → redirect ke `/login`.
 */
export function decideProxyAuth(input: ProxyAuthInput): ProxyAuthDecision {
  if (isPublicPath(input.pathname)) {
    return { kind: "allow" };
  }
  if (input.hasSession) {
    return { kind: "allow" };
  }
  if (input.pathname.startsWith("/api/")) {
    return { kind: "unauthorized" };
  }
  return {
    kind: "redirect",
    callbackUrl: `${input.pathname}${input.search ?? ""}`,
  };
}
