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
import { isPublicPath } from "./lib/auth-paths";

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
     * `authorized` dipanggil middleware tiap request. Return false
     * -> NextAuth akan mengarahkan ke pages.signIn.
     */
    authorized({ auth, request }) {
      const loggedIn = !!auth?.user;
      const isPublic = isPathPublic(request.nextUrl.pathname);
      if (isPublic) return true;
      return loggedIn;
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
