/**
 * Unit test untuk modul Monitoring dan Health Check (S8-03).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    importItem: {
      count: vi.fn(),
    },
    importBatch: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getDetailedSystemHealth,
  recordWorkerHeartbeat,
  getWorkerHeartbeatTimestamp,
} from "@/server/monitoring/health";
import { GET, POST } from "@/app/api/health/route";

describe("System Health & Monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menghasilkan laporan status healthy saat database aktif dan tanpa item gagal", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: 1 }] as never);
    vi.mocked(prisma.importItem.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({
      receivedAt: new Date(),
    } as never);
    vi.mocked(prisma.importBatch.count).mockResolvedValue(5 as never);

    const report = await getDetailedSystemHealth();

    expect(report.ok).toBe(true);
    expect(report.status).toBe("healthy");
    expect(report.database.status).toBe("up");
    expect(report.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(report.ingest.failedItemsLast24h).toBe(0);
    expect(report.ingest.hasAlert).toBe(false);
    expect(report.sourcesFreshness).toHaveLength(3);
  });

  it("menandai status degraded jika terdapat item gagal dalam 24 jam terakhir", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: 1 }] as never);
    // Call 1: failed count = 3
    vi.mocked(prisma.importItem.count).mockResolvedValueOnce(3 as never);
    // Call 2: review count = 1
    vi.mocked(prisma.importItem.count).mockResolvedValueOnce(1 as never);
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.importBatch.count).mockResolvedValue(0 as never);

    const report = await getDetailedSystemHealth();

    expect(report.ok).toBe(true);
    expect(report.status).toBe("degraded");
    expect(report.ingest.failedItemsLast24h).toBe(3);
    expect(report.ingest.hasAlert).toBe(true);
  });

  it("mencatat heartbeat worker dan memverifikasi status keaktifan", () => {
    recordWorkerHeartbeat();
    const ts = getWorkerHeartbeatTimestamp();
    expect(ts).toBeInstanceOf(Date);
  });

  it("GET /api/health basic liveness mengembalikan status live 200", async () => {
    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("live");
  });

  it("POST /api/health menerima dan mengakui heartbeat worker", async () => {
    const req = new Request("http://localhost:3000/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "heartbeat" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.type).toBe("heartbeat_acknowledged");
  });
});
