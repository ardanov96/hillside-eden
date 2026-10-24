/**
 * Health check & Monitoring endpoint (S0-05, S8-03).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §9:
 * - GET /api/health         -> basic liveness cepat (200 OK)
 * - GET /api/health?deep=1  -> deep readiness: latensi DB, kesegaran data sumber OTA,
 *                              status heartbeat worker, dan hitungan item gagal ingest
 * - POST /api/health        -> heartbeat ping dari background worker
 */
import { NextResponse } from "next/server";
import { getDetailedSystemHealth, recordWorkerHeartbeat } from "@/server/monitoring/health";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json({
      ok: true,
      status: "live",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      env: process.env.NODE_ENV ?? "development",
    });
  }

  const health = await getDetailedSystemHealth();
  const statusCode = health.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, { status: statusCode });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.type === "heartbeat" || body.worker) {
      recordWorkerHeartbeat();
      return NextResponse.json({
        ok: true,
        type: "heartbeat_acknowledged",
        recordedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid payload, expected { type: 'heartbeat' }" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 });
  }
}
