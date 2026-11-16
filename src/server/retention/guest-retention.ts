/**
 * Modul Retensi & Privasi Data Tamu (UU PDP No. 27/2022 & S8-04).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §4 & OD-06:
 * - Prinsip minimisasi: simpan minimal, tanpa kontak telepon/email
 * - Job `retention.sweep`: menganonimkan data tamu yang telah melewati masa retensi (retentionUntil)
 * - Sweep juga membuang `rawPayload` pada booking dan `parsedPayload` pada item impor,
 *   serta menghapus berkas berkas (blob) impor yang terkait.
 * - Mencatat mutasi ke AuditLog untuk akuntabilitas hukum
 */
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { writeAudit, AUDIT_ACTIONS } from "@/ingest/pipeline/audit";
import { createStorageProvider } from "@/ingest/storage";

export interface SweepGuestsResult {
  scannedCount: number;
  anonymizedCount: number;
  payloadSweptCount: number;
  blobDeletedCount: number;
  timestamp: string;
}

export const ANONYMIZED_GUEST_NAME = "Tamu Teranonimkan (UU PDP)";

export async function sweepExpiredGuestData(
  options: {
    organizationId?: string;
    now?: Date;
    actorId?: string;
  } = {},
): Promise<SweepGuestsResult> {
  const cutoff = options.now ?? new Date();

  // 1. Cari tamu yang retentionUntil sudah lewat dan belum di-anonimkan
  const expiredGuests = await prisma.guest.findMany({
    where: {
      retentionUntil: { lte: cutoff },
      displayName: { not: ANONYMIZED_GUEST_NAME },
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      displayName: true,
      countryCode: true,
      retentionUntil: true,
    },
  });

  // 2. Transaksi pembaharuan massal: anonimkan tamu + buang rawPayload booking terkait
  let anonymizedCount = 0;
  let payloadSweptCount = 0;

  for (const guest of expiredGuests) {
    await prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id: guest.id },
        data: {
          displayName: ANONYMIZED_GUEST_NAME,
          countryCode: null,
        },
      });

      // Buang rawPayload pada booking milik tamu yang kadaluarsa (hindari render payload mentah)
      const bookingUpdate = await tx.booking.updateMany({
        where: { guestId: guest.id, rawPayload: { not: Prisma.JsonNull } },
        data: { rawPayload: Prisma.JsonNull },
      });
      payloadSweptCount += bookingUpdate.count;

      await writeAudit(tx, {
        organizationId: guest.organizationId,
        actorId: options.actorId ?? "system.retention_sweep",
        action: AUDIT_ACTIONS.guestAnonymized,
        entityType: "Guest",
        entityId: guest.id,
        before: {
          displayName: guest.displayName,
          countryCode: guest.countryCode,
          retentionUntil: guest.retentionUntil,
        },
        after: {
          displayName: ANONYMIZED_GUEST_NAME,
          countryCode: null,
          anonymizedAt: cutoff.toISOString(),
        },
      });
    });

    anonymizedCount += 1;
  }

  // 3. Hapus blob berkas impor (storageKey batch) yang sudah kadaluarsa (best-effort)
  const blobDeletedCount = await sweepImportBatchBlobs(cutoff, options.organizationId);

  // 4. Sweep parsedPayload pada item impor yang sudah lewat masa retensi
  payloadSweptCount += await sweepImportItemPayloads(cutoff, options.organizationId);

  return {
    scannedCount: expiredGuests.length,
    anonymizedCount,
    payloadSweptCount,
    blobDeletedCount,
    timestamp: cutoff.toISOString(),
  };
}

/**
 * Hapus `storageKey` berkas impor batch yang sudah lewat masa retensi
 * dan buang referensinya dari rekaman (best-effort).
 */
async function sweepImportBatchBlobs(cutoff: Date, organizationId?: string): Promise<number> {
  let deletedCount = 0;
  const storage = createStorageProvider();
  try {
    const batches = await prisma.importBatch.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        receivedAt: { lte: cutoff },
        storageKey: { not: null },
      },
      select: { id: true, storageKey: true },
    });

    for (const batch of batches) {
      if (!batch.storageKey) continue;
      try {
        await storage.delete(batch.storageKey);
        deletedCount += 1;
      } catch {
        // Gagal menghapus blob tidak membatalkan sweep.
      }
      // Hapus storageKey dari rekaman setelah berkas terhapus
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { storageKey: null },
      });
    }
  } catch {
    // Gagal membaca batch tidak membatalkan sweep.
  }
  return deletedCount;
}

/**
 * Mengosongkan `parsedPayload` pada ImportItem yang telah melewati batas retensi
 * (berdasarkan createdAt dari batch induk), mencegah penyimpanan payload mentah
 * jangka panjang yang mengandung PII.
 */
async function sweepImportItemPayloads(cutoff: Date, organizationId?: string): Promise<number> {
  const batches = await prisma.importBatch.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      receivedAt: { lte: cutoff },
    },
    select: { id: true },
  });

  if (batches.length === 0) return 0;

  const batchIds = batches.map((b) => b.id);
  const result = await prisma.importItem.updateMany({
    where: {
      batchId: { in: batchIds },
      parsedPayload: { not: Prisma.JsonNull },
    },
    data: { parsedPayload: Prisma.JsonNull },
  });
  return result.count;
}
