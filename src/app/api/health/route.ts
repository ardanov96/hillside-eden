/**
 * Health check endpoint.
 * - GET /api/health         -> basic liveness, selalu 200
 * - GET /api/health?deep=1  -> cek koneksi database (Prisma)
 * Lihat docs/08-quality-security-ops.md #9 untuk sinyal alert.
 */
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import dns from "node:dns/promises";
import net from "node:net";

async function testTcp(
  host: string,
  port = 5432,
  timeoutMs = 4000,
): Promise<{ ok: boolean; error?: string; ip?: string; timeMs?: number }> {
  const start = Date.now();
  try {
    const lookup = await dns.lookup(host);
    return await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => {
        const timeMs = Date.now() - start;
        socket.destroy();
        resolve({ ok: true, ip: lookup.address, timeMs });
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve({ ok: false, error: "ETIMEDOUT", ip: lookup.address, timeMs: Date.now() - start });
      });
      socket.once("error", (err) => {
        resolve({ ok: false, error: err.message, ip: lookup.address, timeMs: Date.now() - start });
      });
      socket.connect(port, lookup.address);
    });
  } catch (err) {
    return { ok: false, error: `DNS_${err instanceof Error ? err.message : String(err)}` };
  }
}

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
      sanitizedUrl = `${u.protocol}//${u.username}:***(len=${u.password.length},pre=${u.password.slice(0, 4)},suf=${u.password.slice(-2)})@${u.host}${u.pathname}${u.search}`;
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

    const tcpDiag = await testTcp("ep-raspy-bar-a17fzwpf-pooler.ap-southeast-1.aws.neon.tech");

    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        db: "down",
        dbUrl: sanitizedUrl,
        tcpDiag,
        directStatus,
        directError,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
      },
      { status: 503 },
    );
  }
}
