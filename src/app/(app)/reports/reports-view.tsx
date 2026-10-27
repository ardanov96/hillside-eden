"use client";

import React, { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Download,
  Printer,
  Lock,
  Unlock,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from "lucide-react";

import { formatIDR } from "@/lib/format-id";
import type { MonthlyOwnerReportDto, PeriodLockListItem } from "@/server/queries/reports";
import { lockPeriodAction, unlockPeriodAction } from "@/server/actions/reports";

export interface ReportsViewProps {
  report: MonthlyOwnerReportDto;
  periodsList: PeriodLockListItem[];
  properties: { id: string; name: string }[];
  currentYear: number;
  currentMonth: number;
  currentPropertyId: string | null;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function ReportsView({
  report,
  periodsList,
  properties,
  currentYear,
  currentMonth,
  currentPropertyId,
}: ReportsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"report" | "closing">("report");
  const [isPending, startTransition] = useTransition();

  // Modal State untuk Tutup Buku
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const k = report.kpis;
  const isLocked = report.lock.isLocked;

  const handlePeriodChange = (year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", year.toString());
    params.set("month", month.toString());
    if (currentPropertyId) params.set("propertyId", currentPropertyId);
    router.push(`/reports?${params.toString()}`);
  };

  const handlePropertyChange = (propId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", currentYear.toString());
    params.set("month", currentMonth.toString());
    if (propId) {
      params.set("propertyId", propId);
    } else {
      params.delete("propertyId");
    }
    router.push(`/reports?${params.toString()}`);
  };

  const handleConfirmLock = () => {
    setActionError(null);
    startTransition(async () => {
      try {
        await lockPeriodAction({ year: currentYear, month: currentMonth });
        setShowLockModal(false);
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Gagal menutup buku");
      }
    });
  };

  const handleConfirmUnlock = () => {
    if (!unlockReason.trim()) {
      setActionError("Alasan pembukaan kembali wajib diisi untuk catatan audit");
      return;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await unlockPeriodAction({
          year: currentYear,
          month: currentMonth,
          reason: unlockReason,
        });
        setShowUnlockModal(false);
        setUnlockReason("");
        router.refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Gagal membuka kembali periode");
      }
    });
  };

  const exportExcelUrl = `/api/reports/export/excel?year=${currentYear}&month=${currentMonth}${
    currentPropertyId ? `&propertyId=${currentPropertyId}` : ""
  }`;

  const printUrl = `/reports/print?year=${currentYear}&month=${currentMonth}${
    currentPropertyId ? `&propertyId=${currentPropertyId}` : ""
  }`;

  return (
    <div className="space-y-6">
      {/* 1. Top Header Banner & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Laporan Pemilik &amp; Tutup Buku
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                isLocked
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400"
              }`}
            >
              {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              <span>{isLocked ? "Buku Terkunci" : "Draf Berjalan"}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Laporan bulanan komprehensif, ekspor Excel/PDF, dan tata kelola tutup buku bulanan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportExcelUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Unduh Excel</span>
          </a>

          <Link
            href={printUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <Printer className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
            <span>Cetak / PDF</span>
          </Link>

          {!isLocked && (
            <button
              onClick={() => setShowLockModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
            >
              <Lock className="h-4 w-4" />
              <span>Tutup Buku Bulan Ini</span>
            </button>
          )}

          {isLocked && (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 transition-colors"
            >
              <Unlock className="h-4 w-4" />
              <span>Buka Kembali</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === "report"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Laporan Bulanan Pemilik</span>
        </button>

        <button
          onClick={() => setActiveTab("closing")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
            activeTab === "closing"
              ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>Kelola Tutup Buku Bulanan</span>
        </button>
      </div>

      {/* TAB 1: LAPORAN BULANAN PEMILIK */}
      {activeTab === "report" && (
        <div className="space-y-6">
          {/* Controls Bar: Bulan & Properti Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Pilih Bulan:</span>
              </div>

              {/* Month Selector */}
              <select
                value={currentMonth}
                onChange={(e) => handlePeriodChange(currentYear, Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={currentYear}
                onChange={(e) => handlePeriodChange(Number(e.target.value), currentMonth)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Property Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Properti:</span>
              <select
                value={currentPropertyId ?? ""}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <option value="">Semua Properti (Gabungan)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Variansi Sejak Penutupan Alert (Bila periode terkunci & angka berubah) */}
          {isLocked && report.lock.variance?.hasVariance && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5 dark:text-amber-400" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-amber-900 uppercase dark:text-amber-200">
                    Selisih Sejak Penutupan Periode Terdeteksi
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Terjadi perubahan data transaksi setelah buku bulan ini ditutup pada{" "}
                    {report.lock.lockedAt
                      ? new Date(report.lock.lockedAt).toLocaleDateString("id-ID")
                      : ""}
                    . Berikut ringkasan variansi terhadap snapshot:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
                    <span className="text-slate-800 dark:text-zinc-200">
                      Selisih Gross:{" "}
                      <strong className="text-amber-900 dark:text-amber-300">
                        {formatIDR(report.lock.variance.grossDiff)}
                      </strong>
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200">
                      Selisih Komisi:{" "}
                      <strong className="text-amber-900 dark:text-amber-300">
                        {formatIDR(report.lock.variance.commissionDiff)}
                      </strong>
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200">
                      Selisih Bersih:{" "}
                      <strong className="text-amber-900 dark:text-amber-300">
                        {formatIDR(report.lock.variance.netDiff)}
                      </strong>
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200">
                      Selisih Beban:{" "}
                      <strong className="text-amber-900 dark:text-amber-300">
                        {formatIDR(report.lock.variance.expensesDiff)}
                      </strong>
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200">
                      Selisih Hasil Operasional:{" "}
                      <strong className="text-amber-900 dark:text-amber-300">
                        {formatIDR(report.lock.variance.operationalResultDiff)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Baris Kartu KPI Utama (Gross -> Komisi -> Net -> Beban -> Hasil Operasional) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Card 1: Gross */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400">
                Nilai Booking (Gross)
              </span>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatIDR(k.gross)}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
                Basis tanggal menginap ({report.periodLabel})
              </div>
            </div>

            {/* Card 2: Komisi OTA */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400">
                Komisi Saluran OTA
              </span>
              <p className="mt-3 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {formatIDR(k.commission)}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
                {k.effectiveCommissionRate}% komisi efektif dari gross
              </div>
            </div>

            {/* Card 3: Pendapatan Bersih */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-bold uppercase tracking-tight text-emerald-700 dark:text-emerald-400">
                Pendapatan Bersih (setelah komisi OTA)
              </span>
              <p className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatIDR(k.net)}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
                Gross dikurangi beban komisi
              </div>
            </div>

            {/* Card 4: Pengeluaran Standar */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-bold uppercase tracking-tight text-rose-700 dark:text-rose-400">
                Beban Operasional Standar
              </span>
              <p className="mt-3 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {formatIDR(k.expenses)}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
                {report.expenseCategories.length} kategori pengeluaran
              </div>
            </div>

            {/* Card 5: Hasil Operasional */}
            <div className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-5 shadow-xs text-white dark:border-zinc-700 dark:bg-zinc-800">
              <span className="text-xs font-bold uppercase tracking-tight text-slate-300 dark:text-zinc-300">
                Hasil Operasional
              </span>
              <p className="mt-3 text-2xl font-black text-white">
                {formatIDR(k.operationalResult)}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-700 text-xs text-slate-300">
                Pendapatan bersih dikurangi beban operasional
              </div>
            </div>

            {/* Card 6: Okupansi & ADR */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400">
                Okupansi &amp; Rata-rata ADR
              </span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {k.occupancyRate}%
                </span>
                <span className="text-xs font-bold text-slate-500">ADR: {formatIDR(k.adr)}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400">
                {k.soldNights} malam terjual dari {k.availableNights} malam tersedia
              </div>
            </div>
          </div>

          {/* 4. Tiga Tabel Rincian Data */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tabel Saluran OTA */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-4">
                Rincian Saluran Penjualan (OTA)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th className="p-2.5">Saluran</th>
                      <th className="p-2.5 text-center">Jml</th>
                      <th className="p-2.5 text-right">Gross</th>
                      <th className="p-2.5 text-right">Komisi</th>
                      <th className="p-2.5 text-right">Bersih</th>
                      <th className="p-2.5 text-center">% Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {report.channels.map((c) => (
                      <tr
                        key={c.channel}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                      >
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {c.channel}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 dark:text-zinc-300">
                          {c.bookingCount}
                        </td>
                        <td className="p-2.5 text-right font-medium text-slate-800 dark:text-zinc-200">
                          {formatIDR(c.gross)}
                        </td>
                        <td className="p-2.5 text-right text-amber-600 dark:text-amber-400 font-medium">
                          {formatIDR(c.commission)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatIDR(c.net)}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-zinc-400">
                          {c.effectiveRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabel Kategori Pengeluaran */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-4">
                Rincian Beban Operasional Per Kategori
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5 text-center">Transaksi</th>
                      <th className="p-2.5 text-right">Jumlah Beban</th>
                      <th className="p-2.5 text-center">Porsi (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {report.expenseCategories.map((exp) => (
                      <tr
                        key={exp.categoryCode}
                        className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                      >
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-zinc-200">
                          {exp.categoryName}
                        </td>
                        <td className="p-2.5 text-center text-slate-500 dark:text-zinc-400">
                          {exp.entryCount}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                          {formatIDR(exp.amount)}
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-600 dark:text-zinc-300">
                          {exp.percentageOfTotal}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Tabel Kinerja Komparatif Properti */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-white mb-4">
              Kinerja Finansial Komparatif Antar Properti
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <tr>
                    <th className="p-2.5">Nama Properti</th>
                    <th className="p-2.5 text-right">Gross</th>
                    <th className="p-2.5 text-right">Pendapatan Bersih</th>
                    <th className="p-2.5 text-right">Beban Operasional</th>
                    <th className="p-2.5 text-right">Hasil Operasional</th>
                    <th className="p-2.5 text-center">Okupansi</th>
                    <th className="p-2.5 text-right">ADR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {report.properties.map((p) => (
                    <tr
                      key={p.propertyId}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {p.propertyName}
                      </td>
                      <td className="p-2.5 text-right font-medium text-slate-800 dark:text-zinc-200">
                        {formatIDR(p.gross)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatIDR(p.net)}
                      </td>
                      <td className="p-2.5 text-right text-rose-600 dark:text-rose-400 font-medium">
                        {formatIDR(p.expenses)}
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900 dark:text-white">
                        {formatIDR(p.operationalResult)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700 dark:text-zinc-300">
                        {p.occupancyRate}%
                      </td>
                      <td className="p-2.5 text-right font-medium text-slate-700 dark:text-zinc-300">
                        {formatIDR(p.adr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KELOLA TUTUP BUKU BULANAN */}
      {activeTab === "closing" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Daftar Periode Tutup Buku (12 Bulan Terakhir)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
              Penutupan buku bulanan membekukan angka finansial dalam bentuk snapshot yang tidak
              dapat diubah. Koreksi data masa lalu hanya dilakukan melalui entri pembalik.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                  <tr>
                    <th className="p-3">Periode</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Waktu Penutupan</th>
                    <th className="p-3">Pengeluaran Draf</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {periodsList.map((item) => (
                    <tr
                      key={item.period}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {item.periodLabel}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.isLocked
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {item.isLocked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                          <span>{item.isLocked ? "Terkunci" : "Terbuka"}</span>
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 dark:text-zinc-400">
                        {item.lockedAt ? new Date(item.lockedAt).toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-zinc-300">
                        {item.draftExpenseCount > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            {item.draftExpenseCount} draf belum verifikasi
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Lengkap</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            const [y, m] = item.period.split("-").map(Number);
                            if (y && m) handlePeriodChange(y, m);
                            setActiveTab("report");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <span>Buka Laporan</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TUTUP BUKU */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tutup Buku Periode {report.periodLabel}
                </h3>
                <p className="text-xs text-slate-500">
                  Membekukan angka finansial menjadi snapshot resmi.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5 dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-slate-500">Snapshot yang akan dikunci:</p>
              <div className="flex justify-between font-medium">
                <span>Nilai Gross:</span>
                <span className="font-bold">{formatIDR(k.gross)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Komisi OTA:</span>
                <span className="font-bold text-amber-600">{formatIDR(k.commission)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Pendapatan Bersih:</span>
                <span className="font-bold text-emerald-600">{formatIDR(k.net)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Beban Operasional:</span>
                <span className="font-bold text-rose-600">{formatIDR(k.expenses)}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-slate-200 pt-1.5 dark:border-zinc-700">
                <span className="font-bold">Hasil Operasional:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {formatIDR(k.operationalResult)}
                </span>
              </div>
            </div>

            {actionError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmLock}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                {isPending ? "Memproses..." : "Konfirmasi Tutup Buku"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUKA KEMBALI */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                <Unlock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Buka Kembali Buku {report.periodLabel}
                </h3>
                <p className="text-xs text-slate-500">
                  Membuka kembali buku akan dicatat di log audit.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Alasan Pembukaan Kembali (Wajib dicatat):
              </label>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Misal: Penyesuaian koreksi komisi OTA Tiket.com setelah verifikasi invoice..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {actionError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmUnlock}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isPending ? "Memproses..." : "Buka Kembali Buku"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
