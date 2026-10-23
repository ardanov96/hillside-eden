/**
 * Halaman Manajemen Kas & Rekonsiliasi Komisi (Sprint 7 / S7-04) - Server Component.
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.5 (Halaman Kas), docs/05 §5.
 */
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { parseGlobalFilterSelection } from "@/lib/filters/global-filter";
import { getCashFlowSummary } from "@/server/queries/cash";
import { getCommissionReconciliation, listCommissionRules } from "@/server/queries/commissions";
import { CashView } from "./cash-view";

export const metadata = { title: "Arus Kas & Komisi - Hillside Eden" };
export const instant = false;

interface CashPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CashPage({ searchParams }: CashPageProps) {
  await connection();
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const flatParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === "string") flatParams[k] = v;
  }

  const filter = parseGlobalFilterSelection(flatParams);

  // Ambil data agregasi arus kas, rekonsiliasi komisi, dan aturan komisi
  const [cashSummary, reconciliation, commissionRules] = await Promise.all([
    getCashFlowSummary({
      organizationId,
      propertyId: filter.propertyId ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
    }),
    getCommissionReconciliation({
      organizationId,
      propertyId: filter.propertyId ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
    }),
    listCommissionRules(),
  ]);

  return (
    <CashView
      cashSummary={cashSummary}
      reconciliation={reconciliation}
      commissionRules={commissionRules}
    />
  );
}
