/**
 * Singleton PrismaClient.
 *
 * Next.js di mode dev melakukan HMR; tanpa singleton kita akan membuat
 * banyak koneksi Postgres setiap hot-reload. Pola ini standar untuk
 * aplikasi Next.js + Prisma.
 *
 * Pemakaian:
 *   import { prisma } from "@/lib/prisma";
 *
 * Catatan: modul ini server-only (Node.js). Jangan diimpor dari
 * komponen klien atau middleware edge runtime.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
