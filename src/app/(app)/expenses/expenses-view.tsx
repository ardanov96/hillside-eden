"use client";

/**
 * Tampilan Utama Modul Pengeluaran dan Pendapatan Lain (S3-01 s/d S3-07).
 *
 * Mengikuti spesifikasi docs/07-ui-spec.md §3.4:
 * - Tab: Beban Pengeluaran, Pendapatan Lain, Template Rutin
 * - Filter: Properti, Kategori, Status (Draf/Terverifikasi), Pencarian
 * - Aksi: Catat baru, Verifikasi draf, Hapus draf, Koreksi entri pembalik (ADR-008)
 * - Tinjau struk/nota nota digital
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  CheckCircle2,
  Clock,
  PlusCircle,
  Receipt,
  RotateCcw,
  Trash2,
  Search,
  DollarSign,
  ArrowUpRight,
  ExternalLink,
  Repeat,
  Play,
  X,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { formatIDR } from "@/lib/format-id";
import type {
  ExpenseItemDto,
  ExpenseSummaryDto,
  ExpenseCategoryDto,
  PropertyOptionDto,
  OtherIncomeItemDto,
  RecurringTemplateItemDto,
} from "@/server/queries/expenses";
import {
  verifyExpenseAction,
  deleteDraftExpenseAction,
  runRecurringTemplatesAction,
  type ExpenseActionResult,
} from "@/server/actions/expenses";

import { ExpenseDialog } from "./expense-dialog";
import { OtherIncomeDialog } from "./other-income-dialog";
import { ReversalDialog } from "./reversal-dialog";
import { RecurringTemplateDialog } from "./recurring-template-dialog";

interface ExpensesViewProps {
  initialExpenses: ExpenseItemDto[];
  totalExpenses: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  summary: ExpenseSummaryDto;
  categories: ExpenseCategoryDto[];
  properties: PropertyOptionDto[];
  otherIncomes: OtherIncomeItemDto[];
  recurringTemplates: RecurringTemplateItemDto[];
  currentPropertyId: string;
  currentCategoryId: string;
  currentStatus: string;
  currentSearch: string;
}

export function ExpensesView({
  initialExpenses,
  totalExpenses,
  currentPage,
  totalPages,
  summary,
  categories,
  properties,
  otherIncomes,
  recurringTemplates,
  currentPropertyId,
  currentCategoryId,
  currentStatus,
  currentSearch,
}: ExpensesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState<"expenses" | "income" | "recurring">("expenses");
  const [isPending, startTransition] = React.useTransition();

  // Dialog states
  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);
  const [isIncomeOpen, setIsIncomeOpen] = React.useState(false);
  const [isRecurringOpen, setIsRecurringOpen] = React.useState(false);
  const [selectedForReversal, setSelectedForReversal] = React.useState<ExpenseItemDto | null>(null);

  // Receipt preview modal state
  const [previewReceiptKey, setPreviewReceiptKey] = React.useState<string | null>(null);

  // Feedback banner state
  const [actionFeedback, setActionFeedback] = React.useState<ExpenseActionResult | null>(null);

  // Filter local state
  const [selectedProp, setSelectedProp] = React.useState(currentPropertyId);
  const [selectedCat, setSelectedCat] = React.useState(currentCategoryId);
  const [selectedStat, setSelectedStat] = React.useState(currentStatus);
  const [searchQuery, setSearchQuery] = React.useState(currentSearch);

  // Sinkronkan filter ke URL
  const applyFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(newParams)) {
      if (val && val !== "ALL") {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    }
    params.set("page", "1");
    router.push(`/expenses?${params.toString()}`);
  };

  const handleVerify = (id: string) => {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await verifyExpenseAction(id);
      setActionFeedback(res);
      if (res.success) router.refresh();
    });
  };

  const handleDeleteDraft = (id: string) => {
    if (!confirm("Hapus draf pengeluaran ini?")) return;
    setActionFeedback(null);
    startTransition(async () => {
      const res = await deleteDraftExpenseAction(id);
      setActionFeedback(res);
      if (res.success) router.refresh();
    });
  };

  const handleRunRecurringNow = () => {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await runRecurringTemplatesAction();
      setActionFeedback(res);
      if (res.success) router.refresh();
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Beban Pengeluaran &amp; Pendapatan Lain
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
              <Wallet className="h-3 w-3" />
              Operasional
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Pencatatan pengeluaran operasional villa, gaji, utilitas, bukti nota struk, dan
            pendapatan non-OTA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsExpenseOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-xs gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Catat Pengeluaran</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsIncomeOpen(true)}
            className="text-xs gap-1.5"
          >
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            <span>Pendapatan Lain</span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`flex items-start justify-between gap-2.5 rounded-lg border p-3 text-xs ${
            actionFeedback.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <div className="flex items-start gap-2">
            {actionFeedback.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <p className="font-medium">{actionFeedback.message}</p>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Pengeluaran */}
        <Card className="rounded-xl border border-slate-200/80 shadow-2xs dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Total Beban Pengeluaran
              </span>
              <span className="rounded-lg bg-rose-50 p-1.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <Wallet className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatIDR(Number(summary.totalAmount))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.totalCount} transaksi tercatat
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Pengeluaran Terverifikasi */}
        <Card className="rounded-xl border border-slate-200/80 shadow-2xs dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Beban Terverifikasi
              </span>
              <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {formatIDR(Number(summary.verifiedAmount))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.verifiedCount} entri siap tutup buku
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Beban Draf */}
        <Card className="rounded-xl border border-slate-200/80 shadow-2xs dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Beban Draf (Menunggu)
              </span>
              <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
              {formatIDR(Number(summary.draftAmount))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.draftCount} entri perlu verifikasi
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Pendapatan Lain */}
        <Card className="rounded-xl border border-slate-200/80 shadow-2xs dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Pendapatan Non-OTA
              </span>
              <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-blue-700 dark:text-blue-400">
              {formatIDR(Number(summary.otherIncomeTotal))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {otherIncomes.length} transaksi F&amp;B / Spa / Langsung
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "expenses"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          <span>Daftar Pengeluaran</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
            {totalExpenses}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("income")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "income"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span>Pendapatan Lain</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
            {otherIncomes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("recurring")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "recurring"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Repeat className="h-3.5 w-3.5" />
          <span>Template Biaya Rutin</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
            {recurringTemplates.length}
          </span>
        </button>
      </div>

      {/* TAB 1: DAFTAR PENGELUARAN */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="rounded-xl border border-slate-200/80 p-3.5 shadow-2xs dark:border-zinc-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari vendor / keterangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters({ search: searchQuery });
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Properti */}
              <select
                value={selectedProp}
                onChange={(e) => {
                  setSelectedProp(e.target.value);
                  applyFilters({ propertyId: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="ALL">Semua Beban Properti</option>
                <option value="SHARED">Biaya Bersama (Shared)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Kategori */}
              <select
                value={selectedCat}
                onChange={(e) => {
                  setSelectedCat(e.target.value);
                  applyFilters({ categoryId: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={selectedStat}
                onChange={(e) => {
                  setSelectedStat(e.target.value);
                  applyFilters({ status: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="ALL">Semua Status (Draf &amp; Terverifikasi)</option>
                <option value="VERIFIED">Hanya Terverifikasi</option>
                <option value="DRAFT">Hanya Draf</option>
              </select>
            </div>
          </Card>

          {/* Table Container */}
          <Card className="rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden dark:border-zinc-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
                  <TableRow>
                    <TableHead className="w-[100px] text-xs">Tanggal</TableHead>
                    <TableHead className="w-[140px] text-xs">Kategori</TableHead>
                    <TableHead className="text-xs">Properti / Alokasi</TableHead>
                    <TableHead className="text-xs">Keterangan &amp; Vendor</TableHead>
                    <TableHead className="text-right text-xs">Nominal</TableHead>
                    <TableHead className="text-center text-xs">Struk</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-500">
                        Tidak ada catatan pengeluaran yang sesuai dengan filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    initialExpenses.map((exp) => {
                      const amountNum = Number(exp.amount);
                      const isNegative = amountNum < 0;

                      return (
                        <TableRow
                          key={exp.id}
                          className="text-xs hover:bg-slate-50/70 dark:hover:bg-zinc-800/40"
                        >
                          {/* Tanggal */}
                          <TableCell className="font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                            {exp.incurredOn}
                          </TableCell>

                          {/* Kategori */}
                          <TableCell>
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {exp.categoryName}
                            </span>
                          </TableCell>

                          {/* Properti */}
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                exp.propertyId
                                  ? "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                              }`}
                            >
                              {exp.propertyName}
                            </span>
                          </TableCell>

                          {/* Keterangan & Vendor */}
                          <TableCell className="max-w-xs">
                            <div className="font-medium text-slate-900 dark:text-white truncate">
                              {exp.description || "-"}
                            </div>
                            {exp.vendor && (
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                                Vendor: {exp.vendor}
                              </div>
                            )}
                          </TableCell>

                          {/* Nominal */}
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            <span
                              className={
                                isNegative
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-900 dark:text-white"
                              }
                            >
                              {formatIDR(amountNum)}
                            </span>
                          </TableCell>

                          {/* Bukti Struk */}
                          <TableCell className="text-center whitespace-nowrap">
                            {exp.receiptKey ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                onClick={() => setPreviewReceiptKey(exp.receiptKey)}
                              >
                                <Receipt className="h-3.5 w-3.5 mr-1" />
                                <span>Lihat</span>
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400">-</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center whitespace-nowrap">
                            {exp.reversalOfId ? (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300">
                                Pembalik
                              </span>
                            ) : exp.hasReversal ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border line-through">
                                Dibalikkan
                              </span>
                            ) : exp.status === "VERIFIED" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Terverifikasi
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                                Draf
                              </span>
                            )}
                          </TableCell>

                          {/* Aksi */}
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Aksi Draf: Verifikasi atau Hapus */}
                              {exp.status === "DRAFT" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    onClick={() => handleVerify(exp.id)}
                                    disabled={isPending}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Verifikasi
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                    onClick={() => handleDeleteDraft(exp.id)}
                                    disabled={isPending}
                                    title="Hapus Draf"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}

                              {/* Aksi Terverifikasi: Koreksi Entri Pembalik (ADR-008) */}
                              {exp.status === "VERIFIED" &&
                                !exp.reversalOfId &&
                                !exp.hasReversal && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50 hover:text-amber-900 dark:text-amber-400"
                                    onClick={() => setSelectedForReversal(exp)}
                                    disabled={isPending}
                                    title="Koreksi via entri pembalik"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Koreksi
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs dark:border-zinc-800">
                <span className="text-slate-500">
                  Halaman {currentPage} dari {totalPages} ({totalExpenses} data)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => applyFilters({ page: String(currentPage - 1) })}
                    className="h-7 text-xs"
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => applyFilters({ page: String(currentPage + 1) })}
                    className="h-7 text-xs"
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: PENDAPATAN LAIN (OTHER INCOME) */}
      {activeTab === "income" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Pencatatan pendapatan dari fasilitas tambahan villa, restoran, spa, dan tamu direct.
            </p>
            <Button
              size="sm"
              onClick={() => setIsIncomeOpen(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Tambah Pendapatan</span>
            </Button>
          </div>

          <Card className="rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden dark:border-zinc-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
                  <TableRow>
                    <TableHead className="w-[110px] text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs">Kategori</TableHead>
                    <TableHead className="text-xs">Properti</TableHead>
                    <TableHead className="text-xs">Keterangan</TableHead>
                    <TableHead className="text-right text-xs">Nominal Masuk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherIncomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-500">
                        Belum ada data pendapatan lain yang dicatat.
                      </TableCell>
                    </TableRow>
                  ) : (
                    otherIncomes.map((oi) => (
                      <TableRow key={oi.id} className="text-xs hover:bg-slate-50/70">
                        <TableCell className="font-medium text-slate-800 dark:text-zinc-200">
                          {oi.receivedOn}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                            {oi.category}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-700 dark:text-zinc-300">
                          {oi.propertyName}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-zinc-400">
                          {oi.description || "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                          +{formatIDR(Number(oi.amount))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: BIAYA RUTIN (RECURRING TEMPLATES) */}
      {activeTab === "recurring" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-500">
              Otomasi pencatatan tagihan berulang bulanan/tahunan (listrik, wifi, gaji,
              pemeliharaan).
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRunRecurringNow}
                disabled={isPending}
                className="text-xs gap-1.5"
              >
                <Play className="h-3.5 w-3.5 text-blue-600" />
                <span>Jalankan Yang Jatuh Tempo</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsRecurringOpen(true)}
                className="bg-slate-900 text-white hover:bg-slate-800 text-xs gap-1.5"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Buat Template</span>
              </Button>
            </div>
          </div>

          <Card className="rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden dark:border-zinc-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
                  <TableRow>
                    <TableHead className="text-xs">Frekuensi</TableHead>
                    <TableHead className="text-xs">Jatuh Tempo Berikutnya</TableHead>
                    <TableHead className="text-xs">Kategori / Properti</TableHead>
                    <TableHead className="text-xs">Vendor &amp; Deskripsi</TableHead>
                    <TableHead className="text-right text-xs">Nominal</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-500">
                        Belum ada template biaya rutin. Buat template baru untuk mengotomasi tagihan
                        berulang.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recurringTemplates.map((t) => (
                      <TableRow key={t.id} className="text-xs hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-200">
                          {t.frequency === "MONTHLY" ? "Bulanan" : "Tahunan"}
                        </TableCell>
                        <TableCell className="font-medium text-blue-600">{t.nextRunOn}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {t.template.categoryName || "Operasional"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.template.propertyName || "Biaya Bersama"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-slate-800 dark:text-zinc-200">
                            {t.template.description || "-"}
                          </div>
                          {t.template.vendor && (
                            <div className="text-[11px] text-slate-500">
                              Vendor: {t.template.vendor}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900 dark:text-white">
                          {formatIDR(Number(t.template.amount || 0))}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            Aktif
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Dialogs */}
      <ExpenseDialog
        open={isExpenseOpen}
        onOpenChange={setIsExpenseOpen}
        categories={categories}
        properties={properties}
        onSuccess={() => router.refresh()}
      />

      <OtherIncomeDialog
        open={isIncomeOpen}
        onOpenChange={setIsIncomeOpen}
        properties={properties}
        onSuccess={() => router.refresh()}
      />

      <ReversalDialog
        open={selectedForReversal !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedForReversal(null);
        }}
        expense={selectedForReversal}
        onSuccess={() => router.refresh()}
      />

      <RecurringTemplateDialog
        open={isRecurringOpen}
        onOpenChange={setIsRecurringOpen}
        categories={categories}
        properties={properties}
        onSuccess={() => router.refresh()}
      />

      {/* Receipt Image Preview Dialog */}
      <Dialog
        open={previewReceiptKey !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewReceiptKey(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-4">
          <DialogHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-600" />
                <span>Bukti Struk Pembayaran</span>
              </DialogTitle>
              {previewReceiptKey && (
                <a
                  href={`/api/receipts/${previewReceiptKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Buka Penuh
                </a>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-3 flex items-center justify-center bg-slate-50 dark:bg-zinc-900 rounded-lg min-h-[300px]">
            {previewReceiptKey && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/receipts/${previewReceiptKey}`}
                alt="Bukti Struk"
                className="max-h-[70vh] max-w-full rounded object-contain shadow-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
