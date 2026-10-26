/**
 * Unit tests untuk Background Worker Runner (S8-03, S3-03, S9-02, S8-04).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    icalFeed: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    calendarBlock: {
      upsert: vi.fn(),
    },
    recurringExpenseTemplate: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    expense: {
      create: vi.fn(),
    },
    guest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) =>
      fn({
        guest: { update: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    ),
  },
}));

vi.mock("@/adapters/ical/fetcher", () => ({
  fetchAndParseIcal: vi.fn(),
  syncIcalToListing: vi.fn(),
}));

vi.mock("@/server/retention/guest-retention", () => ({
  sweepExpiredGuestData: vi.fn(),
}));

vi.mock("@/server/monitoring/health", () => ({
  recordWorkerHeartbeat: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fetchAndParseIcal, syncIcalToListing } from "@/adapters/ical/fetcher";
import { sweepExpiredGuestData } from "@/server/retention/guest-retention";
import { recordWorkerHeartbeat } from "@/server/monitoring/health";
import { encryptText } from "@/lib/crypto";
import { runWorkerTick } from "@/worker/runner";

describe("runWorkerTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mencatat heartbeat worker pada setiap siklus", async () => {
    vi.mocked(prisma.icalFeed.findMany).mockResolvedValue([]);
    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([]);
    vi.mocked(sweepExpiredGuestData).mockResolvedValue({
      scannedCount: 0,
      anonymizedCount: 0,
      timestamp: new Date().toISOString(),
    });

    const res = await runWorkerTick();

    expect(recordWorkerHeartbeat).toHaveBeenCalledTimes(1);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.errors).toEqual([]);
  });

  it("memproses sinkronisasi feed iCal aktif dan memperbarui status", async () => {
    const rawUrl = "https://airbnb.com/calendar/ical/12345.ics";
    const cipherUrl = encryptText(rawUrl);

    vi.mocked(prisma.icalFeed.findMany).mockResolvedValue([
      {
        id: "feed-1",
        listingId: "list-1",
        urlEncrypted: cipherUrl,
        lastFetchedAt: null,
        lastStatus: null,
        listing: {
          id: "list-1",
          name: "Villa Hillside",
          channel: "AIRBNB",
        },
      } as never,
    ]);

    vi.mocked(fetchAndParseIcal).mockResolvedValue({
      events: [
        {
          uid: "event-1",
          startDate: "2026-11-01",
          endDate: "2026-11-05",
          summary: "Airbnb Reserved",
        },
      ],
      rawContent: "BEGIN:VCALENDAR...",
    });

    vi.mocked(syncIcalToListing).mockResolvedValue({
      listingId: "list-1",
      totalParsed: 1,
      upsertedCount: 1,
      errors: [],
    });

    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([]);
    vi.mocked(sweepExpiredGuestData).mockResolvedValue({
      scannedCount: 0,
      anonymizedCount: 0,
      timestamp: new Date().toISOString(),
    });

    const res = await runWorkerTick();

    expect(res.icalFeedsProcessed).toBe(1);
    expect(res.icalBlocksUpserted).toBe(1);
    expect(fetchAndParseIcal).toHaveBeenCalledWith(rawUrl);
    expect(syncIcalToListing).toHaveBeenCalledWith(prisma, "list-1", expect.any(Array));
    expect(prisma.icalFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feed-1" },
        data: expect.objectContaining({
          lastStatus: expect.stringContaining("SUCCESS"),
        }),
      }),
    );
  });

  it("mengisolasi galat pada satu feed iCal tanpa membatalkan tugas lain", async () => {
    vi.mocked(prisma.icalFeed.findMany).mockResolvedValue([
      {
        id: "feed-error",
        listingId: "list-err",
        urlEncrypted: "invalid-cipher-format",
        listing: { id: "list-err", name: "Broken Feed", channel: "AIRBNB" },
      } as never,
    ]);

    vi.mocked(fetchAndParseIcal).mockRejectedValue(new Error("Network timeout"));
    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([]);
    vi.mocked(sweepExpiredGuestData).mockResolvedValue({
      scannedCount: 0,
      anonymizedCount: 0,
      timestamp: new Date().toISOString(),
    });

    const res = await runWorkerTick();

    expect(res.icalFeedsProcessed).toBe(1);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain("Broken Feed");
    expect(prisma.icalFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feed-error" },
        data: expect.objectContaining({
          lastStatus: expect.stringContaining("FAILED"),
        }),
      }),
    );
  });

  it("membuat draf pengeluaran dari template biaya rutin yang jatuh tempo dan memajukan nextRunOn", async () => {
    vi.mocked(prisma.icalFeed.findMany).mockResolvedValue([]);

    const dueNextRun = new Date("2026-10-20");
    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([
      {
        id: "tmpl-1",
        organizationId: "org-1",
        frequency: "MONTHLY",
        nextRunOn: dueNextRun,
        template: {
          amount: "1500000",
          categoryId: "cat-utilitas",
          propertyId: "prop-1",
          vendor: "PLN Listrik",
          description: "Tagihan Listrik Bulanan",
          paymentMethod: "TRANSFER",
        },
      } as never,
    ]);

    vi.mocked(sweepExpiredGuestData).mockResolvedValue({
      scannedCount: 0,
      anonymizedCount: 0,
      timestamp: new Date().toISOString(),
    });

    const res = await runWorkerTick();

    expect(res.recurringTemplatesProcessed).toBe(1);
    expect(res.recurringExpensesCreated).toBe(1);

    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          categoryId: "cat-utilitas",
          propertyId: "prop-1",
          status: "DRAFT",
          vendor: "PLN Listrik",
          description: "[RUTIN] Tagihan Listrik Bulanan",
          recurringTemplateId: "tmpl-1",
          createdById: "system.worker",
        }),
      }),
    );

    expect(prisma.recurringExpenseTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tmpl-1" },
        data: expect.objectContaining({
          nextRunOn: expect.any(Date),
        }),
      }),
    );
  });

  it("menjalankan pembersihan retensi data tamu UU PDP", async () => {
    vi.mocked(prisma.icalFeed.findMany).mockResolvedValue([]);
    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([]);
    vi.mocked(sweepExpiredGuestData).mockResolvedValue({
      scannedCount: 5,
      anonymizedCount: 3,
      timestamp: new Date().toISOString(),
    });

    const res = await runWorkerTick();

    expect(sweepExpiredGuestData).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "system.worker",
      }),
    );
    expect(res.guestsAnonymized).toBe(3);
  });
});
