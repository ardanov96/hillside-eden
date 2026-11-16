/**
 * Proxy Next.js 16 (sebelumnya `middleware.ts`).
 *
 * Proxy ini menjadi GERBANG PERTAMA sebelum route/page dieksekusi:
 * seluruh path non-publik harus punya sesi valid, jika tidak request
 * di-redirect ke `/login` (halaman) atau dibalas 401 JSON (endpoint API).
 *
 * Tambahan P2-9 (keamanan):
 * - Menghasilkan CSP nonce per-request dan menyuntikkannya ke layout lewat
 *   header request `x-csp-nonce`, serta menyetel header respons
 *   `Content-Security-Policy` dengan `nonce-<nilai>`. Ini menggantikan
 *   `unsafe-inline` secara bertahap (non-based CSP).
 * - Menyetel `Strict-Transport-Security` (HSTS) pada setiap respons.
 *
 * Sumber kebenaran: docs/08-quality-security-ops.md §3, src/auth.config.ts
 * (`callbacks.authorized`), src/lib/auth-guard.ts (keputusan murni).
 *
 * PERINGATAN — jangan diubah menjadi `auth(() => {})`:
 * next-auth memakai user-callback sebagai pengganti `callbacks.authorized`
 * dan mengabaikan nilai `false` dari callback `authorized`
 * (node_modules/next-auth/lib/index.js:163-170). Dengan user-callback
 * kosong, proxy menjadi no-op dan SEMUA route terbuka untuk publik.
 * Karena itu callback `authorized` di src/auth.config.ts yang memutuskan,
 * dan proxy ini mengekspor `auth` apa adanya (dilengkapi lapisan CSP di bawah).
 */
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Tipe handler middleware next-auth (request, event) -> Response.
 * Digunakan karena `auth` dari NextAuth authConfig bermacam-masalah overload
 * (getter sesi vs middleware).
 */
type NextAuthMiddlewareHandler = (request: Request, event: unknown) => Promise<Response>;

const authMiddleware = auth as unknown as NextAuthMiddlewareHandler;

/**
 * Kebijakan CSP non-based (nonce). `nonce` diisi per-request oleh middleware.
 * `unsafe-inline` dipertahankan sebagai fallback untuk browser lama; bila
 * nonce tersedia, browser mempercayainya dan mengabaikan `unsafe-inline`.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Lapisan CSP di depan auth middleware. Setiap request mendapat nonce unik
 * yang disuntikkan ke layout (header request `x-csp-nonce`) dan dipakai dalam
 * header respons `Content-Security-Policy`.
 */
export default async function middleware(request: Request, event: unknown) {
  // Buat nonce tanpa Node-only API (works di Edge Runtime via crypto global).
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const nonce = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  request.headers.set("x-csp-nonce", nonce);

  const response = await authMiddleware(request, event);

  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  return response;
}

export const config = {
  // Jalankan proxy untuk semua path KECUALI:
  // - aset statis Next.js (_next/static, _next/image)
  // - file statis di public/ (mengandung titik, mis. favicon.ico)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
