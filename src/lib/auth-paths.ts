/**
 * Daftar path yang tidak memerlukan sesi autentikasi.
 *
 * Path publik adalah:
 * - /login                  : halaman login itu sendiri
 * - /api/auth/*             : handler NextAuth (callback OAuth, dll)
 * - /api/health             : health check (monitoring harus tetap bekerja
 *                             walau tidak ada user login, lihat docs/08 §9)
 * - /_next/* dan /favicon.ico : aset Next.js & favicon
 *
 * Fungsi ini dipakai oleh middleware dan oleh unit test untuk memastikan
 * aturan allow/deny konsisten.
 */

/** Path publik literal atau prefiks. */
const PUBLIC_PREFIXES: ReadonlyArray<string> = ["/_next/", "/api/auth/"];

const PUBLIC_EXACT: ReadonlySet<string> = new Set<string>([
  "/login",
  "/favicon.ico",
  "/api/health",
]);

function normalize(pathname: string): string {
  // Hilangkan query/hash bila ada; middleware menerima pathname saja.
  const q = pathname.indexOf("?");
  const h = pathname.indexOf("#");
  let end = pathname.length;
  if (q !== -1 && q < end) end = q;
  if (h !== -1 && h < end) end = h;
  let p = pathname.slice(0, end);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (path === prefix.replace(/\/$/, "") || path.startsWith(prefix)) return true;
  }
  return false;
}
