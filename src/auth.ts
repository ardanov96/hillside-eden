/**
 * Inisialisasi Auth.js v5 (Node.js runtime).
 *
 * - CredentialsProvider: lookup user via email, verifikasi argon2id.
 * - Session JWT (lihat auth.config.ts untuk callback jwt/session).
 *
 * Yang diekspor:
 *   - auth()             : helper ambil sesi di Server Component / Action
 *   - signIn / signOut   : untuk Server Action form
 *   - handlers           : { GET, POST } untuk route handler App Router
 *
 * Sumber kebenaran: docs/02 §1 (Auth.js credentials), docs/08 §3 (argon2id).
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import authConfig from "./auth.config";
import { prisma } from "./lib/prisma";
import { verifyPassword } from "./lib/argon2";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              role: true,
              organizationId: true,
            },
          });
          if (!user) {
            console.warn(`[auth] User not found: ${email}`);
            return null;
          }

          const ok = await verifyPassword(user.passwordHash, password);
          if (!ok) {
            console.warn(`[auth] Password verification failed for: ${email}`);
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
          };
        } catch (err) {
          console.error(`[auth] Error during authorize for ${email}:`, err);
          return null;
        }
      },
    }),
  ],
});
