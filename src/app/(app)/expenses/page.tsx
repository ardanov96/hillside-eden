/**
 * Halaman Beban Pengeluaran dan Pendapatan Lain (S3-01 s/d S3-07).
 */
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import {
  getExpenses,
  getExpenseSummary,
  getExpenseCategories,
  getOrganizationProperties,
  getOtherIncomes,
  getRecurringTemplates,
} from "@/server/queries/expenses";
import { ExpensesView } from "./expenses-view";

export const metadata = {
  title: "Beban Pengeluaran - Hillside Eden",
  description:
    "Pencatatan pengeluaran operasional villa, gaji staf, utilitas, bukti struk, dan pendapatan non-OTA.",
};

export const instant = false;

interface ExpensesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await connection();
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;
  const rawParams = await searchParams;

  const propertyId = typeof rawParams.propertyId === "string" ? rawParams.propertyId : "ALL";
  const categoryId = typeof rawParams.categoryId === "string" ? rawParams.categoryId : "ALL";
  const status = typeof rawParams.status === "string" ? rawParams.status : "ALL";
  const search = typeof rawParams.search === "string" ? rawParams.search : "";
  const page =
    typeof rawParams.page === "string" ? Math.max(1, parseInt(rawParams.page, 10) || 1) : 1;

  const [expensesData, summary, categories, properties, otherIncomes, recurringTemplates] =
    await Promise.all([
      getExpenses({
        organizationId,
        propertyId: propertyId !== "ALL" ? propertyId : undefined,
        categoryId: categoryId !== "ALL" ? categoryId : undefined,
        status:
          (status as "ALL" | "DRAFT" | "VERIFIED") !== "ALL"
            ? (status as "DRAFT" | "VERIFIED")
            : undefined,
        search: search.trim() || undefined,
        page,
        pageSize: 25,
      }),
      getExpenseSummary(organizationId, {
        propertyId: propertyId !== "ALL" ? propertyId : undefined,
      }),
      getExpenseCategories(organizationId),
      getOrganizationProperties(organizationId),
      getOtherIncomes(organizationId, {
        propertyId: propertyId !== "ALL" ? propertyId : undefined,
      }),
      getRecurringTemplates(organizationId),
    ]);

  return (
    <ExpensesView
      initialExpenses={expensesData.items}
      totalExpenses={expensesData.total}
      currentPage={expensesData.page}
      pageSize={expensesData.pageSize}
      totalPages={expensesData.totalPages}
      summary={summary}
      categories={categories}
      properties={properties}
      otherIncomes={otherIncomes}
      recurringTemplates={recurringTemplates}
      currentPropertyId={propertyId}
      currentCategoryId={categoryId}
      currentStatus={status}
      currentSearch={search}
    />
  );
}
