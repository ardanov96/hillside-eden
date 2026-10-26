"use server";

/**
 * Server Actions untuk Modul Pengeluaran dan Pendapatan Lain (S3-01 s/d S3-07).
 *
 * Mengikuti aturan finansial AGENTS.md:
 * - Uang selalu Decimal, bukan float.
 * - Aturan 5: Koreksi lewat entri pembalik, bukan edit/hapus pada data terverifikasi.
 * - Audit log wajib dicatat pada setiap mutasi.
 * - Penutupan buku (PeriodLock) ditegakkan: periode terkunci menolak pencatatan baru.
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import { writeAudit, AUDIT_ACTIONS } from "@/ingest/pipeline/audit";
import { createStorageProvider } from "@/ingest/storage";
import type { ExpenseStatus, OtherIncomeCategory, RecurringFrequency } from "@prisma/client";

export interface ExpenseActionResult {
  success: boolean;
  message: string;
  id?: string;
}

/**
 * Helper: Cek apakah bulan dari tanggal tertentu telah dikunci (PeriodLock).
 */
async function isPeriodLocked(organizationId: string, date: Date): Promise<boolean> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const periodDate = new Date(`${y}-${m}-01T00:00:00.000Z`);

  const lock = await prisma.periodLock.findUnique({
    where: {
      organizationId_period: {
        organizationId,
        period: periodDate,
      },
    },
  });

  return lock !== null;
}

/**
 * Catat Pengeluaran Baru (S3-01 & S3-02).
 */
export async function createExpenseAction(
  _prevState: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan login kembali." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const amountRaw = formData.get("amount")?.toString()?.trim() || "";
    const categoryId = formData.get("categoryId")?.toString()?.trim() || "";
    const propertyIdRaw = formData.get("propertyId")?.toString()?.trim() || "";
    const incurredOnRaw = formData.get("incurredOn")?.toString()?.trim() || "";
    const paidOnRaw = formData.get("paidOn")?.toString()?.trim() || "";
    const vendor = formData.get("vendor")?.toString()?.trim() || null;
    const description = formData.get("description")?.toString()?.trim() || null;
    const paymentMethod = formData.get("paymentMethod")?.toString()?.trim() || null;
    const statusRaw = formData.get("status")?.toString()?.trim() || "DRAFT";

    // Validasi input wajib
    if (!amountRaw || Number.isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
      return { success: false, message: "Nominal pengeluaran harus berupa angka lebih dari 0." };
    }
    if (!categoryId) {
      return { success: false, message: "Kategori pengeluaran wajib dipilih." };
    }
    if (!incurredOnRaw) {
      return { success: false, message: "Tanggal pengeluaran wajib diisi." };
    }

    const incurredOn = new Date(`${incurredOnRaw}T00:00:00.000Z`);
    if (Number.isNaN(incurredOn.getTime())) {
      return { success: false, message: "Format tanggal pengeluaran tidak valid." };
    }

    // Cek PeriodLock
    const locked = await isPeriodLocked(organizationId, incurredOn);
    if (locked) {
      return {
        success: false,
        message: `Bulan ${incurredOnRaw.slice(0, 7)} telah ditutup buku (Period Lock). Pengeluaran tidak dapat dicatat pada periode terkunci.`,
      };
    }

    const paidOn = paidOnRaw ? new Date(`${paidOnRaw}T00:00:00.000Z`) : null;
    const propertyId = propertyIdRaw && propertyIdRaw !== "SHARED" ? propertyIdRaw : null;
    const amount = new Decimal(amountRaw);
    const status: ExpenseStatus = statusRaw === "VERIFIED" ? "VERIFIED" : "DRAFT";

    // Simpan foto struk jika ada
    let receiptKey: string | null = null;
    const receiptFile = formData.get("receiptFile");
    if (receiptFile && receiptFile instanceof File && receiptFile.size > 0) {
      // Validasi ukuran maks 10MB
      if (receiptFile.size > 10 * 1024 * 1024) {
        return { success: false, message: "Ukuran berkas struk maksimal 10 MB." };
      }
      const safeFilename = receiptFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      receiptKey = `receipts/${organizationId}/${Date.now()}-${safeFilename}`;

      const buffer = Buffer.from(await receiptFile.arrayBuffer());
      const storage = createStorageProvider();
      await storage.put(receiptKey, buffer, {
        contentType: receiptFile.type || "application/octet-stream",
      });
    }

    // Eksekusi transaksi pembuatan pengeluaran
    const created = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          organizationId,
          propertyId,
          categoryId,
          amount,
          currency: "IDR",
          incurredOn,
          paidOn,
          vendor,
          description,
          paymentMethod,
          receiptKey,
          status,
          createdById: actorId || "system",
          verifiedById: status === "VERIFIED" ? actorId : null,
          verifiedAt: status === "VERIFIED" ? new Date() : null,
        },
      });

      // Jika biaya bersama (propertyId === null), buat alokasi proporsional ke semua properti
      if (!propertyId) {
        const properties = await tx.property.findMany({
          where: { organizationId },
          select: { id: true },
          orderBy: { name: "asc" },
        });

        if (properties.length > 0) {
          const count = properties.length;
          const share = amount.dividedBy(count).toDecimalPlaces(0, Decimal.ROUND_DOWN);
          let sumAlloc = new Decimal(0);

          for (let i = 0; i < count; i++) {
            const isLast = i === count - 1;
            const allocAmt = isLast ? amount.minus(sumAlloc) : share;
            sumAlloc = sumAlloc.plus(allocAmt);

            await tx.expenseAllocation.create({
              data: {
                expenseId: exp.id,
                propertyId: properties[i]!.id,
                amountBase: allocAmt,
              },
            });
          }
        }
      }

      // Tulis audit log
      await writeAudit(tx, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.expenseCreated,
        entityType: "Expense",
        entityId: exp.id,
        after: {
          id: exp.id,
          amount: exp.amount.toString(),
          propertyId: exp.propertyId,
          categoryId: exp.categoryId,
          incurredOn: (exp.incurredOn || incurredOn).toISOString(),
          status: exp.status,
        },
      });

      return exp;
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return {
      success: true,
      message: `Pengeluaran sebesar Rp ${amount.toNumber().toLocaleString("id-ID")} berhasil dicatat (${status === "VERIFIED" ? "Terverifikasi" : "Draf"}).`,
      id: created.id,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Terjadi kesalahan sistem saat menyimpan pengeluaran.";
    return { success: false, message: errorMsg };
  }
}

/**
 * Verifikasi Pengeluaran Draf (S3-07).
 */
export async function verifyExpenseAction(expenseId: string): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan login kembali." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });

    if (!existing) {
      return { success: false, message: "Data pengeluaran tidak ditemukan." };
    }

    if (existing.status === "VERIFIED") {
      return { success: false, message: "Pengeluaran sudah berstatus terverifikasi." };
    }

    // Pastikan periode tidak terkunci
    const locked = await isPeriodLocked(organizationId, existing.incurredOn);
    if (locked) {
      return {
        success: false,
        message:
          "Periode bulan pengeluaran ini telah ditutup buku (Period Lock). Status tidak dapat diubah.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: "VERIFIED",
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.expenseVerified,
        entityType: "Expense",
        entityId: expenseId,
        before: { status: "DRAFT" },
        after: { status: "VERIFIED" },
      });
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return { success: true, message: "Pengeluaran berhasil diverifikasi." };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal memverifikasi pengeluaran.",
    };
  }
}

/**
 * Koreksi Pengeluaran Terverifikasi lewat Entri Pembalik (ADR-008, S3-07).
 */
export async function reverseExpenseAction(
  expenseId: string,
  reason: string,
): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan login kembali." };
  }

  if (!reason || !reason.trim()) {
    return { success: false, message: "Alasan koreksi/pembalikan wajib diisi." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const original = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
      include: {
        reversal: { select: { id: true } },
        allocations: true,
      },
    });

    if (!original) {
      return { success: false, message: "Data pengeluaran asal tidak ditemukan." };
    }

    if (original.reversal !== null) {
      return { success: false, message: "Pengeluaran ini sudah pernah dikoreksi sebelumnya." };
    }

    const originalAmount = new Decimal(original.amount.toString());
    const reversalAmount = originalAmount.negated(); // Negatif untuk membatalkan saldo beban

    // Periksa apakah bulan asal terkunci; jika terkunci, entri pembalik dicatat di tanggal hari ini
    const isOriginalMonthLocked = await isPeriodLocked(organizationId, original.incurredOn);
    const reversalDate = isOriginalMonthLocked ? new Date() : original.incurredOn;

    await prisma.$transaction(async (tx) => {
      const reversal = await tx.expense.create({
        data: {
          organizationId,
          propertyId: original.propertyId,
          categoryId: original.categoryId,
          amount: reversalAmount,
          currency: original.currency,
          incurredOn: reversalDate,
          paidOn: reversalDate,
          vendor: original.vendor,
          description: `[KOREKSI PEMBALIK #${original.id.slice(-6)}] ${original.description ?? ""} - Alasan: ${reason.trim()}`,
          paymentMethod: original.paymentMethod,
          status: "VERIFIED",
          reversalOfId: original.id,
          createdById: actorId || "system",
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
      });

      // Salin alokasi properti dengan nilai negatif jika shared
      if (original.allocations.length > 0) {
        for (const alloc of original.allocations) {
          const allocAmt = new Decimal(alloc.amountBase.toString()).negated();
          await tx.expenseAllocation.create({
            data: {
              expenseId: reversal.id,
              propertyId: alloc.propertyId,
              amountBase: allocAmt,
            },
          });
        }
      }

      await writeAudit(tx, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.expenseReversed,
        entityType: "Expense",
        entityId: reversal.id,
        after: {
          reversalOfId: original.id,
          reversalAmount: reversalAmount.toString(),
          reason: reason.trim(),
        },
      });
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return {
      success: true,
      message: `Entri pembalik koreksi berhasil dibuat sebesar -Rp ${originalAmount.abs().toNumber().toLocaleString("id-ID")}.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat entri pembalik koreksi.",
    };
  }
}

/**
 * Hapus Pengeluaran (HANYA diperbolehkan untuk status DRAFT).
 */
export async function deleteDraftExpenseAction(expenseId: string): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
    });

    if (!existing) {
      return { success: false, message: "Data pengeluaran tidak ditemukan." };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false,
        message:
          "Hanya pengeluaran berstatus DRAFT yang dapat dihapus. Pengeluaran terverifikasi harus dikoreksi via entri pembalik.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // Hapus alokasi cascade lalu expense
      await tx.expenseAllocation.deleteMany({ where: { expenseId } });
      await tx.expense.delete({ where: { id: expenseId } });

      await writeAudit(tx, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.expenseDeleted,
        entityType: "Expense",
        entityId: expenseId,
        before: {
          amount: existing.amount.toString(),
          vendor: existing.vendor,
          description: existing.description,
        },
      });
    });

    // Bersihkan file jika ada di storage
    if (existing.receiptKey) {
      try {
        const storage = createStorageProvider();
        await storage.delete(existing.receiptKey);
      } catch {
        // Abaikan galat storage file
      }
    }

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return { success: true, message: "Draf pengeluaran berhasil dihapus." };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menghapus draf pengeluaran.",
    };
  }
}

/**
 * Catat Pendapatan Lain (S3-06).
 */
export async function createOtherIncomeAction(
  _prevState: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const amountRaw = formData.get("amount")?.toString()?.trim() || "";
    const categoryRaw = formData.get("category")?.toString()?.trim() || "";
    const propertyIdRaw = formData.get("propertyId")?.toString()?.trim() || "";
    const receivedOnRaw = formData.get("receivedOn")?.toString()?.trim() || "";
    const description = formData.get("description")?.toString()?.trim() || null;

    if (!amountRaw || Number.isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
      return { success: false, message: "Nominal pendapatan harus lebih dari 0." };
    }
    if (!categoryRaw) {
      return { success: false, message: "Kategori pendapatan lain wajib dipilih." };
    }
    if (!receivedOnRaw) {
      return { success: false, message: "Tanggal penerimaan wajib diisi." };
    }

    const receivedOn = new Date(`${receivedOnRaw}T00:00:00.000Z`);
    const locked = await isPeriodLocked(organizationId, receivedOn);
    if (locked) {
      return {
        success: false,
        message:
          "Periode bulan ini telah ditutup buku. Pendapatan tidak dapat dicatat pada periode terkunci.",
      };
    }

    const amount = new Decimal(amountRaw);
    const category = categoryRaw as OtherIncomeCategory;
    const propertyId = propertyIdRaw && propertyIdRaw !== "ALL" ? propertyIdRaw : null;

    const created = await prisma.$transaction(async (tx) => {
      const oi = await tx.otherIncome.create({
        data: {
          organizationId,
          propertyId,
          category,
          amount,
          currency: "IDR",
          receivedOn,
          description,
          status: "VERIFIED",
          createdById: actorId || "system",
        },
      });

      await writeAudit(tx, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.otherIncomeCreated,
        entityType: "OtherIncome",
        entityId: oi.id,
        after: {
          amount: oi.amount.toString(),
          category: oi.category,
          receivedOn: (oi.receivedOn || receivedOn).toISOString(),
        },
      });

      return oi;
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return {
      success: true,
      message: `Pendapatan lain sebesar Rp ${amount.toNumber().toLocaleString("id-ID")} berhasil dicatat.`,
      id: created.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal mencatat pendapatan lain.",
    };
  }
}

/**
 * Tambah Template Biaya Rutin (S3-03).
 */
export async function createRecurringTemplateAction(input: {
  frequency: RecurringFrequency;
  nextRunOn: string;
  categoryId: string;
  categoryName: string;
  propertyId?: string | null;
  propertyName: string;
  amount: string;
  vendor?: string;
  description?: string;
  paymentMethod?: string;
}): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  try {
    const nextRun = new Date(`${input.nextRunOn}T00:00:00.000Z`);

    const created = await prisma.recurringExpenseTemplate.create({
      data: {
        organizationId,
        frequency: input.frequency,
        nextRunOn: nextRun,
        template: {
          categoryId: input.categoryId,
          categoryName: input.categoryName,
          propertyId: input.propertyId || null,
          propertyName: input.propertyName,
          amount: input.amount,
          vendor: input.vendor,
          description: input.description,
          paymentMethod: input.paymentMethod,
        },
      },
    });

    await writeAudit(prisma, {
      organizationId,
      actorId,
      action: AUDIT_ACTIONS.recurringTemplateCreated,
      entityType: "RecurringExpenseTemplate",
      entityId: created.id,
      after: { frequency: created.frequency, nextRunOn: created.nextRunOn.toISOString() },
    });

    revalidatePath("/expenses");
    return { success: true, message: "Template biaya rutin berhasil dibuat.", id: created.id };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal membuat template biaya rutin.",
    };
  }
}

/**
 * Jalankan Template Biaya Rutin Yang Jatuh Tempo Hari Ini (S3-03).
 */
export async function runRecurringTemplatesAction(): Promise<ExpenseActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid." };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  try {
    const dueTemplates = await prisma.recurringExpenseTemplate.findMany({
      where: {
        organizationId,
        isActive: true,
        nextRunOn: { lte: today },
      },
    });

    if (dueTemplates.length === 0) {
      return {
        success: true,
        message: "Tidak ada template biaya rutin yang jatuh tempo hari ini.",
      };
    }

    let createdCount = 0;

    for (const t of dueTemplates) {
      const tmpl = (t.template as Record<string, unknown>) || {};
      const amount = new Decimal(String(tmpl.amount || "0"));
      if (amount.lessThanOrEqualTo(0)) continue;

      const incurredOn = new Date(t.nextRunOn);
      const categoryId = String(tmpl.categoryId || "");
      const propertyId = tmpl.propertyId ? String(tmpl.propertyId) : null;

      // Buat pengeluaran draf dari template
      await prisma.expense.create({
        data: {
          organizationId,
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
          createdById: actorId || "system",
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

      createdCount += 1;
    }

    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/reports");

    return {
      success: true,
      message: `${createdCount} draf pengeluaran rutin berhasil dibuat otomatis.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Gagal menjalankan template rutin.",
    };
  }
}
