/**
 * Unit test untuk query pengeluaran, ringkasan, dan pendapatan lain (S3-01 s/d S3-07).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    expense: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    property: {
      findMany: vi.fn(),
    },
    expenseCategory: {
      findMany: vi.fn(),
    },
    otherIncome: {
      findMany: vi.fn(),
    },
    recurringExpenseTemplate: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getExpenses,
  getExpenseSummary,
  getExpenseCategories,
  getOrganizationProperties,
  getOtherIncomes,
  getRecurringTemplates,
} from "@/server/queries/expenses";
import { Decimal } from "@/lib/decimal";

describe("Expense Queries (S3-01 s/d S3-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getExpenses: mengambil daftar pengeluaran dengan pagination dan pemetaan nama properti", async () => {
    vi.mocked(prisma.expense.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { id: "prop-1", name: "Hillside Eden (Payangan)", code: "HILLSIDE_EDEN" },
      { id: "prop-2", name: "Ubud Hillside", code: "UBUD_HILLSIDE" },
    ] as never);

    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: "exp-1",
        organizationId: "org-1",
        propertyId: "prop-1",
        categoryId: "cat-1",
        amount: new Decimal(1500000),
        currency: "IDR",
        incurredOn: new Date("2026-10-15T00:00:00Z"),
        paidOn: new Date("2026-10-15T00:00:00Z"),
        vendor: "PLN Gianyar",
        description: "Listrik villa utama",
        paymentMethod: "TRANSFER",
        receiptKey: "receipts/org-1/123.jpg",
        status: "VERIFIED",
        reversalOfId: null,
        reversal: null,
        createdAt: new Date("2026-10-15T10:00:00Z"),
        category: { code: "UTILITIES", name: "Utilitas" },
      },
      {
        id: "exp-2",
        organizationId: "org-1",
        propertyId: null, // Shared
        categoryId: "cat-2",
        amount: new Decimal(800000),
        currency: "IDR",
        incurredOn: new Date("2026-10-16T00:00:00Z"),
        paidOn: null,
        vendor: "Toko Bahan",
        description: "Amenities bersama",
        paymentMethod: "CASH",
        receiptKey: null,
        status: "DRAFT",
        reversalOfId: null,
        reversal: null,
        createdAt: new Date("2026-10-16T10:00:00Z"),
        category: { code: "HOUSEKEEPING", name: "Housekeeping" },
      },
    ] as never);

    const res = await getExpenses({
      organizationId: "org-1",
      page: 1,
      pageSize: 25,
    });

    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
    expect(res.items[0]!.propertyName).toBe("Hillside Eden (Payangan)");
    expect(res.items[0]!.amount).toBe("1500000");
    expect(res.items[0]!.status).toBe("VERIFIED");
    expect(res.items[1]!.propertyName).toBe("Biaya Bersama (Shared)");
    expect(res.items[1]!.status).toBe("DRAFT");
  });

  it("getExpenseSummary: menghitung total, verified, dan draft amount secara akurat", async () => {
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { amount: new Decimal(2000000), status: "VERIFIED" },
      { amount: new Decimal(500000), status: "DRAFT" },
      { amount: new Decimal(1000000), status: "VERIFIED" },
    ] as never);

    vi.mocked(prisma.otherIncome.findMany).mockResolvedValue([
      { amount: new Decimal(750000) },
    ] as never);

    const summary = await getExpenseSummary("org-1");

    expect(summary.totalAmount).toBe("3500000");
    expect(summary.verifiedAmount).toBe("3000000");
    expect(summary.draftAmount).toBe("500000");
    expect(summary.verifiedCount).toBe(2);
    expect(summary.draftCount).toBe(1);
    expect(summary.totalCount).toBe(3);
    expect(summary.otherIncomeTotal).toBe("750000");
  });

  it("getExpenseCategories: mengembalikan daftar kategori terurut", async () => {
    vi.mocked(prisma.expenseCategory.findMany).mockResolvedValue([
      { id: "c-1", code: "SALARY", name: "Gaji & Tunjangan", sortOrder: 1 },
      { id: "c-2", code: "UTILITIES", name: "Utilitas", sortOrder: 2 },
    ] as never);

    const cats = await getExpenseCategories("org-1");
    expect(cats).toHaveLength(2);
    expect(cats[0]!.code).toBe("SALARY");
  });

  it("getOrganizationProperties: mengembalikan daftar properti organisasi", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { id: "p-1", name: "Hillside Eden (Payangan)", slug: "hillside-eden" },
    ] as never);

    const props = await getOrganizationProperties("org-1");
    expect(props).toHaveLength(1);
    expect(props[0]!.slug).toBe("hillside-eden");
  });

  it("getOtherIncomes: mengembalikan daftar pendapatan lain", async () => {
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { id: "p-1", name: "Hillside Eden" },
    ] as never);

    vi.mocked(prisma.otherIncome.findMany).mockResolvedValue([
      {
        id: "oi-1",
        organizationId: "org-1",
        propertyId: "p-1",
        category: "FNB",
        amount: new Decimal(350000),
        currency: "IDR",
        receivedOn: new Date("2026-10-20T00:00:00Z"),
        description: "Dinner BBQ",
        status: "VERIFIED",
        reversalOfId: null,
        createdAt: new Date(),
      },
    ] as never);

    const incomes = await getOtherIncomes("org-1");
    expect(incomes).toHaveLength(1);
    expect(incomes[0]!.category).toBe("FNB");
    expect(incomes[0]!.amount).toBe("350000");
    expect(incomes[0]!.propertyName).toBe("Hillside Eden");
  });

  it("getRecurringTemplates: mengembalikan template biaya rutin aktif", async () => {
    vi.mocked(prisma.recurringExpenseTemplate.findMany).mockResolvedValue([
      {
        id: "tmpl-1",
        organizationId: "org-1",
        frequency: "MONTHLY",
        nextRunOn: new Date("2026-11-01T00:00:00Z"),
        template: {
          categoryName: "Utilitas",
          amount: "1000000",
          vendor: "PLN",
        },
        isActive: true,
        createdAt: new Date(),
      },
    ] as never);

    const tmpls = await getRecurringTemplates("org-1");
    expect(tmpls).toHaveLength(1);
    expect(tmpls[0]!.frequency).toBe("MONTHLY");
    expect((tmpls[0]!.template as { vendor: string }).vendor).toBe("PLN");
  });
});
