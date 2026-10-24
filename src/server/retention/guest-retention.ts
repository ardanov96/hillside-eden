/**
 * Modul Retensi & Privasi Data Tamu (UU PDP No. 27/2022 & S8-04).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §4 & OD-06:
 * - Prinsip minimisasi: simpan minimal, tanpa kontak telepon/email
 * - Job `retention.sweep`: menganonimkan data tamu yang telah melewati masa retensi (retentionUntil)
 * - Mencatat mutasi ke AuditLog untuk akuntabilitas hukum
 */
import { prisma } from "@/lib/prisma";
import { writeAudit, AUDIT_ACTIONS } from "@/ingest/pipeline/audit";

export interface SweepGuestsResult {
  scannedCount: number;
  anonymizedCount: number;
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

  if (expiredGuests.length === 0) {
    return {
      scannedCount: 0,
      anonymizedCount: 0,
      timestamp: cutoff.toISOString(),
    };
  }

  // 2. Transaksi pembaharuan massal dan audit
  let anonymizedCount = 0;

  for (const guest of expiredGuests) {
    await prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id: guest.id },
        data: {
          displayName: ANONYMIZED_GUEST_NAME,
          countryCode: null,
        },
      });

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

  return {
    scannedCount: expiredGuests.length,
    anonymizedCount,
    timestamp: cutoff.toISOString(),
  };
}
