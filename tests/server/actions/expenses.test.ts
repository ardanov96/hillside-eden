/**
 * Unit test untuk Server Actions Pengeluaran (S3-01 s/d S3-07).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/ingest/pipeline/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    expenseCreated: "expense.created",
    expenseUpdated: "expense.updated",
    expenseVerified: "expense.verified",
    expenseReversed: "expense.reversed",
    expenseDeleted: "expense.deleted",
    otherIncomeCreated: "other_income.created",
    otherIncomeReversed: "other_income.reversed",
    recurringTemplateCreated: "recurring_template.created",
    recurringTemplateDeleted: "recurring_template.deleted",
  },
}));

vi.mock("@/ingest/storage", () => ({
  createStorageProvider: vi.fn().mockReturnValue({
    put: vi.fn().mockResolvedValue({ key: "k", size: 100, sha256: "abc" }),
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    periodLock: {
      findUnique: vi.fn(),
    },
    expense: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expenseAllocation: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    property: {
      findMany: vi.fn(),
    },
    otherIncome: {
      create: vi.fn(),
    },
    recurringExpenseTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createExpenseAction,
  verifyExpenseAction,
  reverseExpenseAction,
  deleteDraftExpenseAction,
  createOtherIncomeAction,
} from "@/server/actions/expenses";
import { Decimal } from "@/lib/decimal";

describe("Expense Server Actions (S3-01 s/d S3-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);
  });

  describe("createExpenseAction", () => {
    it("menolak jika user belum login", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as never);
      const fd = new FormData();
      const res = await createExpenseAction(null, fd);
      expect(res.success).toBe(false);
      expect(res.message).toContain("Sesi tidak valid");
    });

    it("menolak jika periode bulan pengeluaran telah ditutup buku (PeriodLock)", async () => {
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce({
        id: "lock-1",
      } as never);

      const fd = new FormData();
      fd.append("amount", "1000000");
      fd.append("categoryId", "cat-1");
      fd.append("incurredOn", "2026-09-15");

      const res = await createExpenseAction(null, fd);
      expect(res.success).toBe(false);
      expect(res.message).toContain("telah ditutup buku");
    });

    it("berhasil mencatat pengeluaran langsung ke properti tunggal", async () => {
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.expense.create).mockResolvedValueOnce({
        id: "exp-123",
        amount: new Decimal(1500000),
      } as never);

      const fd = new FormData();
      fd.append("amount", "1500000");
      fd.append("categoryId", "cat-1");
      fd.append("propertyId", "prop-1");
      fd.append("incurredOn", "2026-10-20");
      fd.append("status", "VERIFIED");

      const res = await createExpenseAction(null, fd);
      expect(res.success).toBe(true);
      expect(res.id).toBe("exp-123");
      expect(prisma.expense.create).toHaveBeenCalled();
    });

    it("berhasil membagi biaya bersama (shared) ke seluruh properti secara merata", async () => {
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.property.findMany).mockResolvedValueOnce([
        { id: "prop-1" },
        { id: "prop-2" },
      ] as never);
      vi.mocked(prisma.expense.create).mockResolvedValueOnce({
        id: "exp-shared",
        amount: new Decimal(1000000),
      } as never);

      const fd = new FormData();
      fd.append("amount", "1000000");
      fd.append("categoryId", "cat-1");
      fd.append("propertyId", "SHARED");
      fd.append("incurredOn", "2026-10-20");

      const res = await createExpenseAction(null, fd);
      expect(res.success).toBe(true);
      expect(prisma.expenseAllocation.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("verifyExpenseAction", () => {
    it("berhasil memverifikasi pengeluaran draf", async () => {
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce({
        id: "exp-1",
        status: "DRAFT",
        incurredOn: new Date("2026-10-10"),
      } as never);
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce(null);

      const res = await verifyExpenseAction("exp-1");
      expect(res.success).toBe(true);
      expect(prisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exp-1" },
          data: expect.objectContaining({ status: "VERIFIED" }),
        }),
      );
    });
  });

  describe("reverseExpenseAction (ADR-008)", () => {
    it("membuat entri pembalik koreksi dengan amount negatif", async () => {
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce({
        id: "exp-orig",
        amount: new Decimal(500000),
        currency: "IDR",
        incurredOn: new Date("2026-10-12"),
        reversal: null,
        allocations: [],
      } as never);
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.expense.create).mockResolvedValueOnce({
        id: "exp-rev-1",
        amount: new Decimal(-500000),
      } as never);

      const res = await reverseExpenseAction("exp-orig", "Salah input nota");
      expect(res.success).toBe(true);
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reversalOfId: "exp-orig",
            amount: expect.objectContaining({
              d: expect.anything(),
            }),
          }),
        }),
      );
    });
  });

  describe("deleteDraftExpenseAction", () => {
    it("berhasil menghapus draf", async () => {
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce({
        id: "exp-draft",
        status: "DRAFT",
        amount: new Decimal(200000),
      } as never);

      const res = await deleteDraftExpenseAction("exp-draft");
      expect(res.success).toBe(true);
      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: "exp-draft" },
      });
    });

    it("menolak menghapus pengeluaran terverifikasi", async () => {
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce({
        id: "exp-verified",
        status: "VERIFIED",
        amount: new Decimal(200000),
      } as never);

      const res = await deleteDraftExpenseAction("exp-verified");
      expect(res.success).toBe(false);
      expect(res.message).toContain("Hanya pengeluaran berstatus DRAFT");
    });
  });

  describe("createOtherIncomeAction", () => {
    it("berhasil mencatat pendapatan non-OTA", async () => {
      vi.mocked(prisma.periodLock.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.otherIncome.create).mockResolvedValueOnce({
        id: "oi-1",
        amount: new Decimal(350000),
      } as never);

      const fd = new FormData();
      fd.append("amount", "350000");
      fd.append("category", "FNB");
      fd.append("receivedOn", "2026-10-21");

      const res = await createOtherIncomeAction(null, fd);
      expect(res.success).toBe(true);
      expect(prisma.otherIncome.create).toHaveBeenCalled();
    });
  });
});
