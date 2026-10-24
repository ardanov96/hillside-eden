/**
 * Modul Monitoring, Health Check, dan Alerting (S8-03).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §9:
 * - Pemeriksaan liveness & readiness database beserta latensi query
 * - Monitoring kesegaran data per sumber (Airbnb, Tiket.com, Traveloka)
 * - Monitoring item gagal ingest (FAILED & NEEDS_REVIEW) dalam 24 jam terakhir
 * - Heartbeat worker untuk mendeteksi worker background yang mati
 */
import { prisma } from "@/lib/prisma";
import type { ChannelCode } from "@prisma/client";

export interface ChannelFreshness {
  channel: ChannelCode;
  lastSyncAt: string | null;
  status: "fresh" | "stale" | "no_data";
  itemCount: number;
}

export interface SystemHealthReport {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: {
    status: "up" | "down";
    latencyMs: number;
    urlSanitized: string;
    error?: string;
  };
  ingest: {
    failedItemsLast24h: number;
    needsReviewItemsCount: number;
    quarantinedTotal: number;
    hasAlert: boolean;
  };
  sourcesFreshness: ChannelFreshness[];
  worker: {
    lastHeartbeatAt: string | null;
    isAlive: boolean;
    workerIntervalSeconds: number;
  };
}

// In-memory heartbeat tracker untuk worker process
let lastWorkerHeartbeatTimestamp: Date | null = null;
const WORKER_EXPECTED_INTERVAL_SEC = 300; // 5 menit

export function recordWorkerHeartbeat(): void {
  lastWorkerHeartbeatTimestamp = new Date();
}

export function getWorkerHeartbeatTimestamp(): Date | null {
  return lastWorkerHeartbeatTimestamp;
}

export async function getDetailedSystemHealth(
  input: {
    organizationId?: string;
  } = {},
): Promise<SystemHealthReport> {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.round(process.uptime());
  const env = process.env.NODE_ENV ?? "development";

  // 1. Sanitasi URL Database
  const rawUrl = process.env.DATABASE_URL;
  let sanitizedUrl = "none";
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.trim());
      sanitizedUrl = `${u.protocol}//${u.username}:***@${u.host}${u.pathname}${u.search}`;
    } catch {
      sanitizedUrl = "MALFORMED";
    }
  }

  // 2. Cek Koneksi & Latensi Database
  let dbStatus: "up" | "down" = "down";
  let latencyMs = -1;
  let dbError: string | undefined;

  const startMs = Date.now();
  try {
    const res = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    latencyMs = Date.now() - startMs;
    if (res[0]?.ok === 1) {
      dbStatus = "up";
    }
  } catch (err) {
    latencyMs = Date.now() - startMs;
    dbError = err instanceof Error ? err.message : String(err);
  }

  // 3. Cek Item Gagal Ingest dalam 24 Jam Terakhir
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let failedItemsCount = 0;
  let needsReviewCount = 0;

  if (dbStatus === "up") {
    try {
      const failedItems = await prisma.importItem.count({
        where: {
          status: "FAILED",
          batch: {
            receivedAt: { gte: twentyFourHoursAgo },
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          },
        },
      });
      failedItemsCount = failedItems;

      const reviewItems = await prisma.importItem.count({
        where: {
          status: "NEEDS_REVIEW",
          ...(input.organizationId ? { batch: { organizationId: input.organizationId } } : {}),
        },
      });
      needsReviewCount = reviewItems;
    } catch {
      // Abaikan jika tabel kosong/transient
    }
  }

  // 4. Cek Kesegaran Sumber Data per Channel Utama (Airbnb, Tiket.com, Traveloka)
  const channelsToCheck: ChannelCode[] = ["AIRBNB", "TIKET_COM", "TRAVELOKA"];
  const sourcesFreshness: ChannelFreshness[] = [];

  if (dbStatus === "up") {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      for (const ch of channelsToCheck) {
        const latestBatch = await prisma.importBatch.findFirst({
          where: {
            channel: ch,
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          },
          orderBy: { receivedAt: "desc" },
          select: { receivedAt: true },
        });

        const totalItems = await prisma.importBatch.count({
          where: {
            channel: ch,
            ...(input.organizationId ? { organizationId: input.organizationId } : {}),
          },
        });

        if (!latestBatch) {
          sourcesFreshness.push({
            channel: ch,
            lastSyncAt: null,
            status: "no_data",
            itemCount: 0,
          });
        } else {
          const isFresh = latestBatch.receivedAt >= fortyEightHoursAgo;
          sourcesFreshness.push({
            channel: ch,
            lastSyncAt: latestBatch.receivedAt.toISOString(),
            status: isFresh ? "fresh" : "stale",
            itemCount: totalItems,
          });
        }
      }
    } catch {
      // Fallback
    }
  }

  // 5. Cek Status Heartbeat Worker
  const nowMs = Date.now();
  const workerAlive =
    lastWorkerHeartbeatTimestamp !== null &&
    nowMs - lastWorkerHeartbeatTimestamp.getTime() <= WORKER_EXPECTED_INTERVAL_SEC * 1000 * 2;

  // 6. Penilaian Status Sistem Menyeluruh
  let systemStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (dbStatus === "down") {
    systemStatus = "unhealthy";
  } else if (failedItemsCount > 0 || latencyMs > 800) {
    systemStatus = "degraded";
  }

  return {
    ok: systemStatus !== "unhealthy",
    status: systemStatus,
    timestamp,
    uptimeSeconds,
    environment: env,
    database: {
      status: dbStatus,
      latencyMs,
      urlSanitized: sanitizedUrl,
      error: dbError,
    },
    ingest: {
      failedItemsLast24h: failedItemsCount,
      needsReviewItemsCount: needsReviewCount,
      quarantinedTotal: failedItemsCount + needsReviewCount,
      hasAlert: failedItemsCount > 0,
    },
    sourcesFreshness,
    worker: {
      lastHeartbeatAt: lastWorkerHeartbeatTimestamp
        ? lastWorkerHeartbeatTimestamp.toISOString()
        : null,
      isAlive: workerAlive,
      workerIntervalSeconds: WORKER_EXPECTED_INTERVAL_SEC,
    },
  };
}
