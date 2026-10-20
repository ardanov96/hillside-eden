/**
 * pipeline/pipeline.ts (S2-02.7) - Orchestrator ingest end-to-end.
 *
 * Menggabungkan seluruh modul S2-02 menjadi satu alur yang dapat dipanggil
 * dari server action / worker:
 *
 *   RawInput
 *     -> router.parse()            (S2-02.3)
 *     -> hash content (idempotency lapis 1: ImportItem.contentHash)
 *     -> resolveListing per event  (S2-02.4)
 *     -> applyBookingEvent per event (S2-02.5, dalam transaksi + retry)
 *     -> audit log                (S2-02.6)
 *     -> ImportBatch.stats
 *
 * Prinsip:
 * - Deterministik: input sama + state DB sama -> hasil sama.
 * - Tidak ada LLM di jalur produksi (AGENTS.md aturan 3).
 * - Kegagalan per-item TIDAK menghentikan seluruh batch; item problematic
 *   masuk quarantine (ImportItem.status = NEEDS_REVIEW atau FAILED).
 * - Semua mutasi keuangan event-source: tidak ada UPDATE pada BookingEvent.
 */
import { createHash } from "node:crypto";
import type { PrismaClient, ImportItemStatus, Prisma } from "@prisma/client";

import type { ParsedBookingEvent, RawInput } from "@/adapters/types";
import { withSerializableTransaction } from "@/server/prisma-tx";
import type { RouterRegistry } from "./router";
import { resolveListing } from "./listing-resolver";
import { applyBookingEvent, type UpsertOutcome } from "./upsert";
import { AUDIT_ACTIONS, writeAudit } from "./audit";

/** Ringkasan hasil ingest satu batch. */
export interface PipelineResult {
  batchId: string;
  total: number;
  created: number;
  updated: number;
  duplicate: number;
  failed: number;
  needsReview: number;
  errors: Array<{ itemId: string; code: string; message: string }>;
}

/** Input untuk menjalankan pipeline. */
export interface RunIngestInput {
  organizationId: string;
  /** Actor (user) bila dipicu UI; null bila worker/otomatis. */
  actorId?: string | null;
  kind: "EMAIL" | "CSV" | "ICAL" | "MANUAL";
  channel?: import("@/adapters/types").ChannelCode | null;
  filename?: string | null;
  /** Kunci blob di storage bila input berasal dari file yang sudah diunggah. */
  storageKey?: string | null;
  /** RawInput untuk adapter. */
  rawInput: RawInput;
  /** Override listingId (untuk S2-04 form manual). */
  manualListingId?: string;
}

/**
 * Hitung contentHash stabil untuk idempotency lapis 1:
 * SHA-256 dari (adapterId + JSON payload dengan urutan key stabil) agar
 * dua batch dengan isi identik terdeteksi duplikat.
 */
export function computeContentHash(adapterId: string, payload: unknown): string {
  const normalized = stableStringify(payload);
  return createHash("sha256").update(`${adapterId}::${normalized}`).digest("hex");
}

/** JSON.stringify dengan urutan key stabil (untuk hashing deterministik). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * Orkestrasi utama. Mengembalikan PipelineResult berisi statistik + errors.
 *
 * Alur per event:
 * 1. resolveListing -> bila needsReview, catat ImportItem NEEDS_REVIEW.
 * 2. applyBookingEvent dalam transaksi serializable (dengan retry).
 * 3. ImportItem.status = PARSED (atau DUPLICATE bila unique event).
 */
export async function runIngest(
  prisma: PrismaClient,
  router: RouterRegistry,
  input: RunIngestInput,
): Promise<PipelineResult> {
  // 1. Parse via router.
  const parseResult = await router.parse(input.rawInput);

  // 2. Buat batch.
  const batch = await prisma.importBatch.create({
    data: {
      organizationId: input.organizationId,
      kind: input.kind,
      channel: input.channel ?? null,
      filename: input.filename ?? null,
      storageKey: input.storageKey ?? null,
    },
    select: { id: true },
  });

  await writeAudit(prisma, {
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    action: AUDIT_ACTIONS.importBatchStarted,
    entityType: "ImportBatch",
    entityId: batch.id,
    after: { kind: input.kind, filename: input.filename },
  });

  if (!parseResult.ok) {
    // Parsing gagal seluruh input: catat satu ImportItem FAILED dan return.
    const errorItem = await prisma.importItem.create({
      data: {
        batchId: batch.id,
        status: "FAILED",
        contentHash: computeContentHash("parse-error", {
          filename: input.filename,
          error: parseResult.errorCode,
        }),
        errorCode: parseResult.errorCode,
        errorMessage: parseResult.message,
      },
      select: { id: true },
    });

    const result: PipelineResult = {
      batchId: batch.id,
      total: 1,
      created: 0,
      updated: 0,
      duplicate: 0,
      failed: 1,
      needsReview: 0,
      errors: [{ itemId: errorItem.id, code: parseResult.errorCode, message: parseResult.message }],
    };
    await finalizeBatch(prisma, input, batch.id, result);
    return result;
  }

  // 3. Loop events.
  const stats = {
    created: 0,
    updated: 0,
    duplicate: 0,
    failed: 0,
    needsReview: 0,
  };
  const errors: PipelineResult["errors"] = [];

  for (const event of parseResult.events) {
    const outcome = await processSingleEvent(prisma, input, batch.id, event, errors);
    if (outcome === "created") stats.created++;
    else if (outcome === "updated") stats.updated++;
    else if (outcome === "duplicate") stats.duplicate++;
    else if (outcome === "failed") stats.failed++;
    else if (outcome === "needsReview") stats.needsReview++;
  }

  const result: PipelineResult = {
    batchId: batch.id,
    total: parseResult.events.length,
    ...stats,
    errors,
  };
  await finalizeBatch(prisma, input, batch.id, result);
  return result;
}

/**
 * Proses satu event: resolve listing, apply ke DB, catat ImportItem.
 * Tidak melempar error; kegagalan dicatat agar batch tetap lanjut.
 */
async function processSingleEvent(
  prisma: PrismaClient,
  input: RunIngestInput,
  batchId: string,
  event: ParsedBookingEvent,
  errors: PipelineResult["errors"],
): Promise<UpsertOutcome["kind"] | "failed" | "needsReview"> {
  const { booking } = event;

  // Resolve listing (kecuali MANUAL yang sudah punya listingId dari form).
  const resolution = await resolveListing(prisma as never, {
    organizationId: input.organizationId,
    booking,
    options: input.manualListingId ? { listingId: input.manualListingId } : {},
  });

  if (resolution.kind === "needsReview") {
    const item = await recordImportItem(prisma, {
      batchId,
      status: "NEEDS_REVIEW",
      event,
      errorCode: resolution.reason,
      errorMessage: resolution.message,
    });
    errors.push({ itemId: item, code: resolution.reason, message: resolution.message });
    await writeAudit(prisma, {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: AUDIT_ACTIONS.importItemQuarantined,
      entityType: "ImportItem",
      entityId: item,
      after: {
        reason: resolution.reason,
        channel: booking.channel,
        externalId: booking.externalId,
      },
    });
    return "needsReview";
  }

  // Terapkan event ke DB dalam transaksi serializable.
  try {
    const outcome = await withSerializableTransaction(prisma, async (tx) => {
      return applyBookingEvent(tx as never, {
        organizationId: input.organizationId,
        listingId: resolution.listingId,
        propertyId: resolution.propertyId,
        booking,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        actorId: input.actorId ?? null,
      });
    });

    const itemStatus: ImportItemStatus = outcome.kind === "duplicate" ? "DUPLICATE" : "PARSED";
    await recordImportItem(prisma, {
      batchId,
      status: itemStatus,
      event,
      importItemExtra: { bookingId: outcome.bookingId, outcome: outcome.kind },
    });

    if (outcome.kind === "created") {
      await writeAudit(prisma, {
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        action: AUDIT_ACTIONS.bookingCreated,
        entityType: "Booking",
        entityId: outcome.bookingId,
        after: {
          channel: booking.channel,
          externalId: booking.externalId,
          gross: booking.grossAmount,
        },
      });
    } else if (outcome.kind === "updated") {
      await writeAudit(prisma, {
        organizationId: input.organizationId,
        actorId: input.actorId ?? null,
        action:
          booking.status === "CANCELLED"
            ? AUDIT_ACTIONS.bookingCancelled
            : AUDIT_ACTIONS.bookingUpdated,
        entityType: "Booking",
        entityId: outcome.bookingId,
        after: { channel: booking.channel, status: booking.status },
      });
    }

    return outcome.kind;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = "APPLY_FAILED";
    const item = await recordImportItem(prisma, {
      batchId,
      status: "FAILED",
      event,
      errorCode: code,
      errorMessage: message,
    });
    errors.push({ itemId: item, code, message });
    await writeAudit(prisma, {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: AUDIT_ACTIONS.importItemFailed,
      entityType: "ImportItem",
      entityId: item,
      after: { reason: message },
    });
    return "failed";
  }
}

/**
 * Catat satu ImportItem dengan contentHash (idempotency lapis 1).
 * Bila contentHash sudah ada di batch yang sama, kembalikan id yang ada.
 */
async function recordImportItem(
  prisma: PrismaClient,
  args: {
    batchId: string;
    status: ImportItemStatus;
    event: ParsedBookingEvent;
    errorCode?: string;
    errorMessage?: string;
    importItemExtra?: Record<string, unknown>;
  },
): Promise<string> {
  const contentHash = computeContentHash("event", {
    channel: args.event.booking.channel,
    externalId: args.event.booking.externalId,
    eventType: args.event.eventType,
    occurredAt: args.event.occurredAt.toISOString(),
  });

  const existing = await prisma.importItem.findUnique({
    where: { batchId_contentHash: { batchId: args.batchId, contentHash } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.importItem.create({
    data: {
      batchId: args.batchId,
      status: args.status,
      contentHash,
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
      parsedPayload: safeJson({
        eventType: args.event.eventType,
        occurredAt: args.event.occurredAt.toISOString(),
        booking: args.event.booking,
        ...(args.importItemExtra ?? {}),
      }),
    },
    select: { id: true },
  });
  return created.id;
}

/** Konversi aman ke Prisma.InputJsonValue (tidak cyclic). */
function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Tutup batch: tulis stats & audit selesai. */
async function finalizeBatch(
  prisma: PrismaClient,
  input: RunIngestInput,
  batchId: string,
  result: PipelineResult,
): Promise<void> {
  const statsJson = safeJson({
    total: result.total,
    created: result.created,
    updated: result.updated,
    duplicate: result.duplicate,
    failed: result.failed,
    needsReview: result.needsReview,
    errorCount: result.errors.length,
  });
  await prisma.importBatch.update({
    where: { id: batchId },
    data: { stats: statsJson },
  });
  await writeAudit(prisma, {
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    action: AUDIT_ACTIONS.importBatchFinished,
    entityType: "ImportBatch",
    entityId: batchId,
    after: {
      total: result.total,
      created: result.created,
      updated: result.updated,
      duplicate: result.duplicate,
      failed: result.failed,
      needsReview: result.needsReview,
    },
  });
}
