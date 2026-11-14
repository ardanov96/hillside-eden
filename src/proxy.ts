/**
 * Proxy Next.js 16 (sebelumnya `middleware.ts`).
 *
 * Proxy ini menjadi GERBANG PERTAMA sebelum route/page dieksekusi:
 * seluruh path non-publik harus punya sesi valid, jika tidak request
 * di-redirect ke `/login` (halaman) atau dibalas 401 JSON (endpoint API).
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
 * dan proxy ini mengekspor `auth` apa adanya.
 */
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * `auth` tanpa user-callback → next-auth memakai `callbacks.authorized`
 * dan hasilnya (true / Response 401 / redirect) langsung dipakai sebagai
 * jawaban proxy.
 */
export default auth;

export const config = {
  // Jalankan proxy untuk semua path KECUALI:
  // - aset statis Next.js (_next/static, _next/image)
  // - file statis di public/ (mengandung titik, mis. favicon.ico)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
