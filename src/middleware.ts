/**
 * Middleware proteksi route.
 *
 * Strategi:
 * - Pakai `auth.config.ts` saja (tanpa Prisma/argon2) agar tetap berjalan
 *   di edge runtime.
 * - Callback `authorized` (lihat src/auth.config.ts) menentukan apakah
 *   request diizinkan. Bila tidak, Auth.js otomatis redirect ke
 *   pages.signIn = "/login".
 *
 * Catatan:
 * - Matcher mengecualikan aset statis Next.js agar tidak membebani
 *   middleware untuk/_next/* (di sini TIDAK dievaluasi karena Auth.js
 *   skip pada path publik; disimpan sebagai pengaman tambahan).
 */
import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth(() => {
  // Logika allow/deny seluruhnya ditentukan oleh callback `authorized`
  // pada authConfig. Middleware ini hanya memastikan handler terpasang.
});

export const config = {
  // Jalankan middleware untuk semua path KECUALI:
  // - aset statis Next.js (_next/static, _next/image)
  // - file di public/ (favicon, robots, dst.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
