/**
 * Hillside Eden Background Worker Runner (S8-03, S3-03, S9-02, S8-04).
 *
 * Menjalankan tugas latar belakang terjadwal:
 * 1. Sinkronisasi kalender iCal eksternal untuk seluruh listing aktif
 * 2. Pemrosesan draf biaya rutin dari template yang jatuh tempo
 * 3. Pembersihan retensi data tamu (UU PDP No. 27/2022)
 * 4. Pengiriman heartbeat periodik untuk memantau liveness worker
 */
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import { decryptText } from "@/lib/crypto";
import { fetchAndParseIcal, syncIcalToListing } from "@/adapters/ical/fetcher";
import { sweepExpiredGuestData } from "@/server/retention/guest-retention";
import { recordWorkerHeartbeat } from "@/server/monitoring/health";

export interface WorkerTickResult {
  icalFeedsProcessed: number;
  icalBlocksUpserted: number;
  recurringTemplatesProcessed: number;
  recurringExpensesCreated: number;
  guestsAnonymized: number;
  errors: string[];
  durationMs: number;
  timestamp: string;
}

export interface WorkerOptions {
  intervalMs?: number;
  runOnce?: boolean;
}

/**
 * Eksekusi satu siklus tick kerja background worker.
 */
export async function runWorkerTick(): Promise<WorkerTickResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  let icalFeedsProcessed = 0;
  let icalBlocksUpserted = 0;
  let recurringTemplatesProcessed = 0;
  let recurringExpensesCreated = 0;
  let guestsAnonymized = 0;

  // 1. Catat Heartbeat Worker
  try {
    recordWorkerHeartbeat();
  } catch (err) {
    errors.push(`Heartbeat error: ${(err as Error).message}`);
  }

  // 2. Sinkronisasi Feed iCal Eksternal
  try {
    const activeFeeds = await prisma.icalFeed.findMany({
      where: {
        listing: {
          isActive: true,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            channel: true,
          },
        },
      },
    });

    for (const feed of activeFeeds) {
      if (!feed.urlEncrypted) continue;
      icalFeedsProcessed++;

      try {
        const plainUrl = decryptText(feed.urlEncrypted);
        if (!plainUrl) {
          throw new Error("Gagal mendekripsi URL iCal");
        }

        const { events } = await fetchAndParseIcal(plainUrl);
        const syncRes = await syncIcalToListing(prisma, feed.listingId, events);

        icalBlocksUpserted += syncRes.upsertedCount;

        await prisma.icalFeed.update({
          where: { id: feed.id },
          data: {
            lastFetchedAt: new Date(),
            lastStatus: `SUCCESS: ${syncRes.upsertedCount} blok kalender disinkronkan`,
          },
        });
      } catch (feedErr) {
        const msg = (feedErr as Error).message;
        errors.push(`iCal [${feed.listing.name}]: ${msg}`);

        try {
          await prisma.icalFeed.update({
            where: { id: feed.id },
            data: {
              lastStatus: `FAILED: ${msg}`,
            },
          });
        } catch {
          // Abaikan error update status
        }
      }
    }
  } catch (err) {
    errors.push(`Gagal memuat feed iCal: ${(err as Error).message}`);
  }

  // 3. Pemrosesan Biaya Rutin (Recurring Expense Templates)
  try {
    const now = new Date();
    now.setUTCHours(23, 59, 59, 999);

    const dueTemplates = await prisma.recurringExpenseTemplate.findMany({
      where: {
        isActive: true,
        nextRunOn: { lte: now },
      },
    });

    for (const t of dueTemplates) {
      recurringTemplatesProcessed++;

      try {
        const tmpl = (t.template as Record<string, unknown>) || {};
        const amount = new Decimal(String(tmpl.amount || "0"));
        if (amount.lessThanOrEqualTo(0)) continue;

        const incurredOn = new Date(t.nextRunOn);
        const categoryId = String(tmpl.categoryId || "");
        const propertyId = tmpl.propertyId ? String(tmpl.propertyId) : null;

        await prisma.expense.create({
          data: {
            organizationId: t.organizationId,
            propertyId,
            categoryId,
            amount,
            currency: "IDR",
            incurredOn,
            vendor: tmpl.vendor ? String(tmpl.vendor) : null,
            description: tmpl.description ? `[RUTIN] ${String(tmpl.description)}` : "[RUTIN]",
            paymentMethod: tmpl.paymentMethod ? String(tmpl.paymentMethod) : "TRANSFER",
            status: "DRAFT",
            recurringTemplateId: t.id,
            createdById: "system.worker",
          },
        });

        // Hitung nextRunOn berikutnya
        const nextRun = new Date(t.nextRunOn);
        if (t.frequency === "MONTHLY") {
          nextRun.setUTCMonth(nextRun.getUTCMonth() + 1);
        } else {
          nextRun.setUTCFullYear(nextRun.getUTCFullYear() + 1);
        }

        await prisma.recurringExpenseTemplate.update({
          where: { id: t.id },
          data: { nextRunOn: nextRun },
        });

        recurringExpensesCreated++;
      } catch (tmplErr) {
        errors.push(`Template rutin [${t.id}]: ${(tmplErr as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Gagal memproses template rutin: ${(err as Error).message}`);
  }

  // 4. Sweeper Retensi Data Tamu UU PDP
  try {
    const sweepRes = await sweepExpiredGuestData({
      now: new Date(),
      actorId: "system.worker",
    });
    guestsAnonymized = sweepRes.anonymizedCount;
  } catch (err) {
    errors.push(`Gagal menjalankan retensi tamu: ${(err as Error).message}`);
  }

  const durationMs = Date.now() - startTime;

  return {
    icalFeedsProcessed,
    icalBlocksUpserted,
    recurringTemplatesProcessed,
    recurringExpensesCreated,
    guestsAnonymized,
    errors,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Loop background worker yang berjalan terus atau single-run.
 */
export async function startWorkerLoop(options: WorkerOptions = {}): Promise<void> {
  const isOnce = options.runOnce ?? process.argv.includes("--once");
  const envInterval = process.env.WORKER_INTERVAL_MS
    ? parseInt(process.env.WORKER_INTERVAL_MS, 10)
    : NaN;
  const intervalMs = options.intervalMs ?? (!isNaN(envInterval) ? envInterval : 300_000); // 5 menit

  console.log(
    `[Worker] Memulai Hillside Eden Background Worker (mode: ${isOnce ? "once" : `loop setiap ${intervalMs / 1000} detik`})`,
  );

  let isRunning = false;

  const tick = async () => {
    if (isRunning) {
      console.warn("[Worker] Siklus sebelumnya masih berjalan, melewati tick ini.");
      return;
    }
    isRunning = true;

    try {
      console.log(`[Worker] [${new Date().toISOString()}] Menjalankan siklus terjadwal...`);
      const res = await runWorkerTick();

      console.log(
        `[Worker] Selesai dalam ${res.durationMs}ms: ` +
          `${res.icalFeedsProcessed} feed iCal (${res.icalBlocksUpserted} blok), ` +
          `${res.recurringExpensesCreated} draf beban rutin, ` +
          `${res.guestsAnonymized} tamu teranonimkan.`,
      );

      if (res.errors.length > 0) {
        console.error(`[Worker] Terdapat ${res.errors.length} peringatan/galat:`);
        for (const e of res.errors) {
          console.error(`  - ${e}`);
        }
      }
    } catch (err) {
      console.error("[Worker] Kesalahan fatal dalam siklus worker:", err);
    } finally {
      isRunning = false;
    }
  };

  // Jalankan segera tick pertama
  await tick();

  if (isOnce) {
    console.log("[Worker] Mode single-run selesai. Keluar.");
    return;
  }

  // Jadwalkan pengulangan periodik
  const timer = setInterval(tick, intervalMs);

  const shutdown = () => {
    console.log("[Worker] Menerima sinyal terminasi, mematikan worker secara aman...");
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
