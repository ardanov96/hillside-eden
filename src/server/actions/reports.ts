"use server";

/**
 * Server Actions untuk Tutup Buku Bulanan & Audit (S8-01).
 *
 * Mengikuti spesifikasi:
 * - docs/05-business-rules.md §7 (Penutupan Periode & Pembukaan Kembali)
 * - docs/04-data-model.md (PeriodLock, AuditLog)
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit, AUDIT_ACTIONS } from "@/ingest/pipeline/audit";
import { getMonthlyOwnerReport, type ReportSnapshot } from "../queries/reports";

export interface LockPeriodInput {
  year: number;
  month: number;
  note?: string;
}

export async function lockPeriodAction(input: { year: number; month: number }) {
  const session = await auth();
  if (!session?.user?.organizationId || !session?.user?.id) {
    throw new Error("Unauthorized: Anda harus login untuk melakukan tutup buku");
  }

  const { organizationId, id: userId } = session.user;
  const { year, month } = input;

  if (month < 1 || month > 12) {
    throw new Error("Bulan tidak valid (1-12)");
  }

  // 1. Ambil data laporan bulan tersebut untuk snapshot
  const report = await getMonthlyOwnerReport({
    organizationId,
    year,
    month,
  });

  if (!report.lock.canLock) {
    const reason = report.lock.unmetRequirements.join(", ");
    throw new Error(`Tidak dapat menutup buku: ${reason}`);
  }

  const snapshot: ReportSnapshot = {
    gross: report.kpis.gross,
    commission: report.kpis.commission,
    net: report.kpis.net,
    expenses: report.kpis.expenses,
    operationalResult: report.kpis.operationalResult,
    soldNights: report.kpis.soldNights,
    occupancyRate: report.kpis.occupancyRate,
  };

  const periodDate = new Date(Date.UTC(year, month - 1, 1));

  // 2. Transaksi Prisma: simpan PeriodLock & tulis AuditLog
  const monthStr = month.toString().padStart(2, "0");
  const periodKey = `${year}-${monthStr}`;

  await prisma.$transaction(async (tx) => {
    const lock = await tx.periodLock.create({
      data: {
        organizationId,
        period: periodDate,
        lockedById: userId,
        snapshot: snapshot as never,
      },
    });

    await writeAudit(tx, {
      organizationId,
      actorId: userId,
      action: AUDIT_ACTIONS.periodLocked,
      entityType: "PeriodLock",
      entityId: lock.id,
      before: null,
      after: {
        period: periodKey,
        snapshot,
      },
    });
  });

  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, period: periodKey };
}

export async function unlockPeriodAction(input: { year: number; month: number; reason: string }) {
  const session = await auth();
  if (!session?.user?.organizationId || !session?.user?.id) {
    throw new Error("Unauthorized: Anda harus login untuk membuka kembali periode");
  }

  const { organizationId, id: userId } = session.user;
  const { year, month, reason } = input;

  if (!reason.trim()) {
    throw new Error("Alasan pembukaan kembali periode wajib diisi");
  }

  const periodDate = new Date(Date.UTC(year, month - 1, 1));
  const monthStr = month.toString().padStart(2, "0");
  const periodKey = `${year}-${monthStr}`;

  // Cari PeriodLock yang ada
  const existingLock = await prisma.periodLock.findUnique({
    where: {
      organizationId_period: {
        organizationId,
        period: periodDate,
      },
    },
  });

  if (!existingLock) {
    throw new Error(`Periode ${periodKey} belum terkunci`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.periodLock.delete({
      where: {
        id: existingLock.id,
      },
    });

    await writeAudit(tx, {
      organizationId,
      actorId: userId,
      action: AUDIT_ACTIONS.periodUnlocked,
      entityType: "PeriodLock",
      entityId: existingLock.id,
      before: {
        period: periodKey,
        lockedAt: existingLock.lockedAt,
        lockedById: existingLock.lockedById,
      },
      after: {
        period: periodKey,
        reason,
        unlockedBy: userId,
      },
    });
  });

  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, period: periodKey };
}
