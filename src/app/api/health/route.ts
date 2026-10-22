/**
 * Health check endpoint.
 * - GET /api/health         -> basic liveness, selalu 200
 * - GET /api/health?deep=1  -> cek koneksi database (Prisma)
 * Lihat docs/08-quality-security-ops.md #9 untuk sinyal alert.
 */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// Hindari membuat banyak PrismaClient saat Next.js HMR (dev mode).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const startedAt = new Date().toISOString();

  if (!deep) {
    return NextResponse.json({
      ok: true,
      status: "live",
      startedAt,
      env: process.env.NODE_ENV ?? "development",
    });
  }

  const rawUrl = process.env.DATABASE_URL;
  let sanitizedUrl = "none";
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.trim());
      sanitizedUrl = `${u.protocol}//${u.username}:***@${u.host}${u.pathname}${u.search}`;
    } catch {
      sanitizedUrl = `MALFORMED (length=${rawUrl.length}, prefix=${rawUrl.slice(0, 20)})`;
    }
  }

  // Deep check: verifikasi database.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        error: "DATABASE_URL not configured",
        startedAt,
      },
      { status: 503 },
    );
  }

  try {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    return NextResponse.json({
      ok: true,
      status: "live",
      db: "up",
      dbResult: result[0]?.ok === 1 ? "ok" : "unexpected",
      dbUrl: sanitizedUrl,
      startedAt,
      env: process.env.NODE_ENV ?? "development",
    });
  } catch (error) {
    const directUrl = process.env.DIRECT_DATABASE_URL;
    let directStatus = "untested";
    let directError = null;
    if (directUrl) {
      try {
        const directPrisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
        const res = await directPrisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
        await directPrisma.$disconnect();
        directStatus = res[0]?.ok === 1 ? "up" : "unexpected";
      } catch (e) {
        directStatus = "down";
        directError = e instanceof Error ? e.message : String(e);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        db: "down",
        dbUrl: sanitizedUrl,
        directStatus,
        directError,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
      },
      { status: 503 },
    );
  }
}
