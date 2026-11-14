/**
 * Konfigurasi Auth.js v5 yang edge-compatible (tanpa Node.js API).
 *
 * Dipakai oleh middleware (runtime edge) untuk memutuskan route mana
 * yang terproteksi. Bagian ini TIDAK BOLEH mengimpor:
 * - @prisma/client
 * - @node-rs/argon2
 * - modul lain yang tergantung Node.js intrinsics
 *
 * Provider yang butuh basis data (Credentials + argon2) dipasang di
 * src/auth.ts yang berjalan di Node.js runtime.
 *
 * Sumber kebenaran: docs/02 §1, docs/08 §3.
 */
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { isPublicPath } from "./lib/auth-paths";
import { decideProxyAuth } from "./lib/auth-guard";

export { isPublicPath };
export const isPathPublic = isPublicPath;

const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Strategi default "jwt" agar middleware edge tidak butuh DB session.
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * `authorized` adalah SATU-SATUNYA gerbang otorisasi di lapisan proxy.
     *
     * Penting: next-auth mengabaikan nilai `false` dari callback ini bila
     * proxy memakai user-callback (`auth(() => {})`). Karena itu proxy
     * (`src/proxy.ts`) mengekspor `auth` apa adanya tanpa user-callback,
     * sehingga hasil `false`/Response di sini benar-benar diterapkan.
     *
     * Lihat docs/08-quality-security-ops.md §3 dan src/lib/auth-guard.ts.
     */
    authorized({ auth, request }) {
      const decision = decideProxyAuth({
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        hasSession: !!auth?.user,
      });

      if (decision.kind === "allow") {
        return true;
      }
      if (decision.kind === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", decision.callbackUrl);
      return NextResponse.redirect(loginUrl);
    },
    /**
     * Sisipkan role dan organizationId ke JWT agar bisa diakses
     * server-side lewat helper `auth()`.
     */
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id?: string;
          role?: string;
          organizationId?: string;
        };
        if (u.role) token.role = u.role;
        if (u.organizationId) token.organizationId = u.organizationId;
        if (u.id) token.userId = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as {
          role?: string;
          organizationId?: string;
          userId?: string;
        };
        const user = session.user as {
          id?: string;
          role?: string;
          organizationId?: string;
        };
        user.id = t.userId ?? token.sub;
        user.role = t.role ?? "OWNER";
        user.organizationId = t.organizationId;
      }
      return session;
    },
  },
  providers: [], // diisi di src/auth.ts (butuh Prisma + argon2)
};

export default authConfig;
