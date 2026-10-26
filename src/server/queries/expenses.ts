/**
 * Kueri Server untuk Modul Pengeluaran dan Pendapatan Lain (S3-01 s/d S3-07).
 *
 * Mengikuti spesifikasi:
 * - docs/07-ui-spec.md §3.4 (Halaman Pengeluaran, filter, status Draf/Terverifikasi, entri pembalik)
 * - docs/05-business-rules.md §6 (Pengeluaran dan penutupan buku)
 * - docs/04-data-model.md (Expense, ExpenseCategory, ExpenseAllocation, RecurringExpenseTemplate, OtherIncome)
 */
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";
import type {
  Prisma,
  ExpenseStatus,
  OtherIncomeCategory,
  RecurringFrequency,
} from "@prisma/client";

export interface ExpenseItemDto {
  id: string;
  propertyId: string | null;
  propertyName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  amount: string;
  currency: string;
  incurredOn: string;
  paidOn: string | null;
  vendor: string | null;
  description: string | null;
  paymentMethod: string | null;
  receiptKey: string | null;
  status: ExpenseStatus;
  reversalOfId: string | null;
  hasReversal: boolean;
  createdAt: string;
}

export interface ExpenseFilter {
  organizationId: string;
  propertyId?: string; // "ALL" | "SHARED" | specific property ID
  categoryId?: string;
  status?: "ALL" | ExpenseStatus;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ExpenseSummaryDto {
  totalAmount: string;
  verifiedAmount: string;
  draftAmount: string;
  draftCount: number;
  verifiedCount: number;
  totalCount: number;
  otherIncomeTotal: string;
}

export interface OtherIncomeItemDto {
  id: string;
  propertyId: string | null;
  propertyName: string;
  category: OtherIncomeCategory;
  amount: string;
  currency: string;
  receivedOn: string;
  description: string | null;
  status: ExpenseStatus;
  reversalOfId: string | null;
  hasReversal: boolean;
  createdAt: string;
}

export interface RecurringTemplateItemDto {
  id: string;
  frequency: RecurringFrequency;
  nextRunOn: string;
  template: {
    categoryId?: string;
    categoryName?: string;
    propertyId?: string | null;
    propertyName?: string;
    amount?: string | number;
    vendor?: string;
    description?: string;
    paymentMethod?: string;
  };
  isActive: boolean;
  createdAt: string;
}

export interface ExpenseCategoryDto {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface PropertyOptionDto {
  id: string;
  name: string;
  slug: string;
}

/**
 * Mengambil daftar pengeluaran dengan filter, pagination, dan relasi.
 */
export async function getExpenses(filter: ExpenseFilter): Promise<{
  items: ExpenseItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ExpenseWhereInput = {
    organizationId: filter.organizationId,
  };

  // Filter Properti
  if (filter.propertyId && filter.propertyId !== "ALL") {
    if (filter.propertyId === "SHARED") {
      where.propertyId = null;
    } else {
      where.propertyId = filter.propertyId;
    }
  }

  // Filter Kategori
  if (filter.categoryId && filter.categoryId !== "ALL") {
    where.categoryId = filter.categoryId;
  }

  // Filter Status
  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }

  // Filter Tanggal Pengeluaran (incurredOn)
  if (filter.from || filter.to) {
    where.incurredOn = {};
    if (filter.from) {
      where.incurredOn.gte = new Date(`${filter.from}T00:00:00.000Z`);
    }
    if (filter.to) {
      where.incurredOn.lte = new Date(`${filter.to}T23:59:59.999Z`);
    }
  }

  // Filter Pencarian Teks (vendor atau deskripsi)
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { vendor: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rawExpenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        category: true,
        reversal: { select: { id: true } },
      },
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  // Ambil data properti untuk mapping nama
  const properties = await prisma.property.findMany({
    where: { organizationId: filter.organizationId },
    select: { id: true, name: true },
  });
  const propertyMap = new Map(properties.map((p) => [p.id, p.name]));

  const items: ExpenseItemDto[] = rawExpenses.map((e) => {
    const propertyName = e.propertyId
      ? (propertyMap.get(e.propertyId) ?? "Properti Tak Dikenal")
      : "Biaya Bersama (Shared)";

    return {
      id: e.id,
      propertyId: e.propertyId,
      propertyName,
      categoryId: e.categoryId,
      categoryCode: e.category.code,
      categoryName: e.category.name,
      amount: e.amount.toString(),
      currency: e.currency,
      incurredOn: e.incurredOn.toISOString().slice(0, 10),
      paidOn: e.paidOn ? e.paidOn.toISOString().slice(0, 10) : null,
      vendor: e.vendor,
      description: e.description,
      paymentMethod: e.paymentMethod,
      receiptKey: e.receiptKey,
      status: e.status,
      reversalOfId: e.reversalOfId,
      hasReversal: e.reversal !== null,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Ringkasan agregat pengeluaran dan pendapatan lain untuk kartu metrik.
 */
export async function getExpenseSummary(
  organizationId: string,
  filter?: { from?: string; to?: string; propertyId?: string },
): Promise<ExpenseSummaryDto> {
  const whereExpense: Prisma.ExpenseWhereInput = { organizationId };
  const whereOtherIncome: Prisma.OtherIncomeWhereInput = { organizationId };

  if (filter?.propertyId && filter.propertyId !== "ALL") {
    if (filter.propertyId === "SHARED") {
      whereExpense.propertyId = null;
    } else {
      whereExpense.propertyId = filter.propertyId;
      whereOtherIncome.propertyId = filter.propertyId;
    }
  }

  if (filter?.from || filter?.to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filter.from) dateFilter.gte = new Date(`${filter.from}T00:00:00.000Z`);
    if (filter.to) dateFilter.lte = new Date(`${filter.to}T23:59:59.999Z`);
    whereExpense.incurredOn = dateFilter;
    whereOtherIncome.receivedOn = dateFilter;
  }

  const [expenses, otherIncomes] = await Promise.all([
    prisma.expense.findMany({
      where: whereExpense,
      select: { amount: true, status: true },
    }),
    prisma.otherIncome.findMany({
      where: whereOtherIncome,
      select: { amount: true },
    }),
  ]);

  let total = new Decimal(0);
  let verified = new Decimal(0);
  let draft = new Decimal(0);
  let draftCount = 0;
  let verifiedCount = 0;

  for (const e of expenses) {
    const amt = new Decimal(e.amount.toString());
    total = total.plus(amt);
    if (e.status === "VERIFIED") {
      verified = verified.plus(amt);
      verifiedCount += 1;
    } else {
      draft = draft.plus(amt);
      draftCount += 1;
    }
  }

  let otherIncomeTotal = new Decimal(0);
  for (const oi of otherIncomes) {
    otherIncomeTotal = otherIncomeTotal.plus(new Decimal(oi.amount.toString()));
  }

  return {
    totalAmount: total.toString(),
    verifiedAmount: verified.toString(),
    draftAmount: draft.toString(),
    draftCount,
    verifiedCount,
    totalCount: expenses.length,
    otherIncomeTotal: otherIncomeTotal.toString(),
  };
}

/**
 * Mengambil daftar kategori pengeluaran aktif.
 */
export async function getExpenseCategories(organizationId: string): Promise<ExpenseCategoryDto[]> {
  const cats = await prisma.expenseCategory.findMany({
    where: { organizationId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return cats.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    sortOrder: c.sortOrder,
  }));
}

/**
 * Mengambil daftar properti organisasi.
 */
export async function getOrganizationProperties(
  organizationId: string,
): Promise<PropertyOptionDto[]> {
  const props = await prisma.property.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return props;
}

/**
 * Mengambil daftar Pendapatan Lain (OtherIncome).
 */
export async function getOtherIncomes(
  organizationId: string,
  filter?: { from?: string; to?: string; propertyId?: string },
): Promise<OtherIncomeItemDto[]> {
  const where: Prisma.OtherIncomeWhereInput = { organizationId };

  if (filter?.propertyId && filter.propertyId !== "ALL") {
    where.propertyId = filter.propertyId;
  }

  if (filter?.from || filter?.to) {
    where.receivedOn = {};
    if (filter.from) where.receivedOn.gte = new Date(`${filter.from}T00:00:00.000Z`);
    if (filter.to) where.receivedOn.lte = new Date(`${filter.to}T23:59:59.999Z`);
  }

  const [raw, properties] = await Promise.all([
    prisma.otherIncome.findMany({
      where,
      orderBy: { receivedOn: "desc" },
    }),
    prisma.property.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const pMap = new Map(properties.map((p) => [p.id, p.name]));

  return raw.map((oi) => ({
    id: oi.id,
    propertyId: oi.propertyId,
    propertyName: oi.propertyId ? (pMap.get(oi.propertyId) ?? "-") : "Portofolio Umum",
    category: oi.category,
    amount: oi.amount.toString(),
    currency: oi.currency,
    receivedOn: oi.receivedOn.toISOString().slice(0, 10),
    description: oi.description,
    status: oi.status,
    reversalOfId: oi.reversalOfId,
    hasReversal: false,
    createdAt: oi.createdAt.toISOString(),
  }));
}

/**
 * Mengambil daftar Template Biaya Rutin.
 */
export async function getRecurringTemplates(
  organizationId: string,
): Promise<RecurringTemplateItemDto[]> {
  const raw = await prisma.recurringExpenseTemplate.findMany({
    where: { organizationId },
    orderBy: { nextRunOn: "asc" },
  });

  return raw.map((t) => ({
    id: t.id,
    frequency: t.frequency,
    nextRunOn: t.nextRunOn.toISOString().slice(0, 10),
    template: (t.template as Record<string, unknown>) ?? {},
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
  }));
}
