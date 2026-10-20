/**
 * Memperluas tipe bawaan Auth.js v5 agar aplikasi kita mengenali
 * field tambahan (id, role, organizationId) pada session.user dan JWT.
 *
 * Tanpa file ini TypeScript akan menolak `session.user.role` dsb.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      organizationId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    organizationId?: string;
    userId?: string;
  }
}
