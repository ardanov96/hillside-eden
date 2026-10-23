"use client";

import React, { useState, useTransition } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { ChannelCode, CollectType } from "@prisma/client";

import { formatCurrency, formatIDR } from "@/lib/format-id";
import type { CashFlowSummaryDto } from "@/server/queries/cash";
import type {
  CommissionReconciliationSummary,
  CommissionRuleDto,
} from "@/server/queries/commissions";
import {
  createCommissionRuleAction,
  deleteCommissionRuleAction,
  estimateBookingCommissionAction,
} from "@/server/actions/commissions";
import { GrossCommissionNetCard } from "@/components/finance/gross-commission-net-card";
import { CollectTypeBadge } from "@/components/badges/collect-type-badge";
import { DataStatusBadge } from "@/components/badges/data-status-badge";

export interface CashViewProps {
  cashSummary: CashFlowSummaryDto;
  reconciliation: CommissionReconciliationSummary;
  commissionRules: CommissionRuleDto[];
}

export function CashView({ cashSummary, reconciliation, commissionRules }: CashViewProps) {
  const [activeTab, setActiveTab] = useState<"flow" | "reconciliation" | "rules">("flow");
  const [isPending, startTransition] = useTransition();

  // State untuk form penambahan aturan komisi
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [ruleChannel, setRuleChannel] = useState<ChannelCode>("AIRBNB");
  const [ruleRatePct, setRuleRatePct] = useState<string>("15");
  const [ruleCollectType, setRuleCollectType] = useState<CollectType>("CHANNEL_COLLECT");
  const [ruleValidFrom, setRuleValidFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [ruleValidTo, setRuleValidTo] = useState<string>("");
  const [ruleNotes, setRuleNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rateNum = Number.parseFloat(ruleRatePct);
    if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setFormError("Rate komisi harus berupa angka persentase antara 0% dan 100%");
      return;
    }

    const rateDecimal = (rateNum / 100).toFixed(4);

    startTransition(async () => {
      try {
        await createCommissionRuleAction({
          channel: ruleChannel,
          rate: rateDecimal,
          collectType: ruleCollectType,
          validFrom: ruleValidFrom,
          validTo: ruleValidTo.trim() ? ruleValidTo : null,
          notes: ruleNotes.trim() ? ruleNotes : null,
        });
        setShowAddRuleModal(false);
        setRuleNotes("");
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Gagal menambahkan aturan komisi");
      }
    });
  };

  const handleDeleteRule = (id: string) => {
    if (!confirm("Hapus aturan komisi ini?")) return;
    startTransition(async () => {
      await deleteCommissionRuleAction(id);
    });
  };

  const handleEstimateBooking = (bookingId: string) => {
    startTransition(async () => {
      await estimateBookingCommissionAction(bookingId);
    });
  };

  const m = cashSummary.metrics;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Arus Kas & Komisi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring kas masuk/keluar, komisi terutang Hotel Collect, riwayat payout, dan
            rekonsiliasi selisih komisi OTA.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("flow")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "flow"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Arus Kas & Saldo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reconciliation")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "reconciliation"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Rekonsiliasi Komisi</span>
            {reconciliation.summary.discrepancyBookings > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {reconciliation.summary.discrepancyBookings}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "rules"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Aturan Komisi ({commissionRules.length})
          </button>
        </div>
      </div>

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Kas Masuk */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Kas Masuk
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatIDR(m.totalCashIn)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>Payout: {formatIDR(m.payoutsReceived)}</span>
            </div>
          </div>
        </div>

        {/* 2. Kas Keluar */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Kas Keluar
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatIDR(m.totalCashOut)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Beban operasional terbayar</div>
          </div>
        </div>

        {/* 3. Arus Kas Bersih */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Arus Kas Bersih
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-xl font-bold tracking-tight ${
                Number(m.netCashFlow) >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              {formatIDR(m.netCashFlow)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Kas Masuk − Kas Keluar</div>
          </div>
        </div>

        {/* 4. Komisi Terutang (Hotel Collect) */}
        <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
              Komisi Terutang
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-amber-950 tracking-tight">
              {formatIDR(m.totalOutstandingCommission)}
            </div>
            <div className="text-[11px] text-amber-700 mt-1 font-medium">
              Wajib disetor ke OTA (Hotel Collect)
            </div>
          </div>
        </div>

        {/* 5. Pendapatan Belum Cair */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Belum Cair
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatIDR(m.totalPendingPayout)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Tamu checkout, payout menunggu</div>
          </div>
        </div>
      </div>

      {/* TAB 1: ARUS KAS & SALDO KOMISI TERUTANG */}
      {activeTab === "flow" && (
        <div className="space-y-8">
          {/* Section: Saldo Komisi Terutang Hotel Collect */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    Saldo Komisi Terutang per OTA (Hotel Collect)
                  </h2>
                  <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                    docs/05 §5
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tamu membayar langsung ke properti saat menginap. Komisi merupakan hutang ke OTA
                  hingga ditagihkan.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Kanal OTA</th>
                    <th className="px-5 py-3 text-right">Total Penerimaan Tamu (Bruto)</th>
                    <th className="px-5 py-3 text-right">Komisi Wajib Disetor</th>
                    <th className="px-5 py-3 text-center">Jumlah Booking</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashSummary.outstandingCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic">
                        Tidak ada saldo komisi terutang saat ini. Seluruh komisi Hotel Collect telah
                        lunas atau belum ada booking Hotel Collect.
                      </td>
                    </tr>
                  ) : (
                    cashSummary.outstandingCommissions.map((c) => (
                      <tr key={c.channel} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{c.channelName}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-800">
                          {formatIDR(c.totalGrossCollected)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-amber-700">
                          {formatIDR(c.totalCommissionPayable)}
                        </td>
                        <td className="px-5 py-3.5 text-center text-slate-700">
                          {c.bookingCount} reservasi
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Menunggu Tagihan / Setoran
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Riwayat Payout OTA */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Riwayat Payout Diterima (Channel Collect)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transfer pencairan dana dari extranet OTA yang telah masuk dan ditautkan ke
                  reservasi (S7-02).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Tanggal Payout</th>
                    <th className="px-5 py-3">Kanal OTA</th>
                    <th className="px-5 py-3">Referensi Transfer</th>
                    <th className="px-5 py-3 text-right">Jumlah Dicairkan</th>
                    <th className="px-5 py-3 text-center">Booking Terkait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashSummary.recentPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic">
                        Belum ada laporan payout yang diimpor. Payout dapat diimpor lewat CSV
                        riwayat transaksi Airbnb / extranet OTA.
                      </td>
                    </tr>
                  ) : (
                    cashSummary.recentPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-slate-900">{p.payoutDate}</td>
                        <td className="px-5 py-3.5 text-slate-800 font-medium">{p.channelName}</td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                          {p.reference}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                          {formatCurrency(p.amount, p.currency as "IDR" | "USD")}
                        </td>
                        <td className="px-5 py-3.5 text-center text-slate-700">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800">
                            {p.linkedBookingsCount} booking
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Pendapatan Selesai Menginap Belum Cair (Pending Payouts) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-semibold text-slate-900">
                Pendapatan Sudah Terjadi tapi Belum Cair
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar reservasi Channel Collect yang tamunya telah selesai menginap (checkout &le;
                hari ini) namun belum menerima transfer payout dari OTA.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Kode Booking</th>
                    <th className="px-5 py-3">Kanal OTA</th>
                    <th className="px-5 py-3">Properti</th>
                    <th className="px-5 py-3">Tanggal Checkout</th>
                    <th className="px-5 py-3 text-right">Pendapatan Kotor</th>
                    <th className="px-5 py-3 text-right">Estimasi Kas Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashSummary.pendingPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic">
                        Seluruh pendapatan booking yang sudah checkout telah cair. Tidak ada pending
                        payout.
                      </td>
                    </tr>
                  ) : (
                    cashSummary.pendingPayouts.slice(0, 15).map((pb) => (
                      <tr key={pb.bookingId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-medium text-slate-900">
                          {pb.externalId}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{pb.channelName}</td>
                        <td className="px-5 py-3.5 text-slate-600">{pb.propertyName}</td>
                        <td className="px-5 py-3.5 text-slate-600">{pb.checkOut}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                          {formatCurrency(pb.grossAmount, pb.currency as "IDR" | "USD")}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                          {formatCurrency(pb.estimatedNet, pb.currency as "IDR" | "USD")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REKONSILIASI KOMISI (ESTIMASI VS AKTUAL) */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          {/* Ringkasan Rekonsiliasi Card */}
          <GrossCommissionNetCard
            gross={reconciliation.summary.totalGross}
            commission={reconciliation.summary.totalActualCommission}
            currency={reconciliation.summary.currency as "IDR" | "USD"}
            commissionBasis="ACTUAL"
            title="Ringkasan Finansial Rekonsiliasi Komisi (S7-03)"
          />

          {/* Tabel Rekonsiliasi Komisi */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    Daftar Rekonsiliasi Komisi Booking
                  </h2>
                  <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-full">
                    {reconciliation.summary.totalBookings} Total
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Membandingkan komisi estimasi aturan vs komisi aktual dari transfer/payout OTA
                  (golden case docs/05 §9.6).
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {reconciliation.summary.matchedBookings} Cocok
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium border border-amber-100">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {reconciliation.summary.discrepancyBookings} Selisih
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Kode Booking</th>
                    <th className="px-4 py-3">Kanal</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3 text-right">Pendapatan Kotor</th>
                    <th className="px-4 py-3 text-right">Estimasi Komisi</th>
                    <th className="px-4 py-3 text-right">Aktual Komisi</th>
                    <th className="px-4 py-3 text-right">Selisih</th>
                    <th className="px-4 py-3 text-center">Basis</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconciliation.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-slate-400 italic">
                        Tidak ada data booking untuk direkonsiliasi.
                      </td>
                    </tr>
                  ) : (
                    reconciliation.items.map((item) => {
                      const hasVariance = Number(item.variance) !== 0;
                      return (
                        <tr
                          key={item.bookingId}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            hasVariance ? "bg-amber-50/30" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-medium text-slate-900">
                            {item.externalId}
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{item.channel}</td>
                          <td className="px-4 py-3 text-slate-600">{item.checkIn}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {formatCurrency(item.grossAmount, item.currency as "IDR" | "USD")}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(
                              item.estimatedCommission,
                              item.currency as "IDR" | "USD",
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-900">
                            {formatCurrency(item.actualCommission, item.currency as "IDR" | "USD")}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              hasVariance ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {hasVariance
                              ? `${Number(item.variance) > 0 ? "+" : ""}${formatCurrency(
                                  item.variance,
                                  item.currency as "IDR" | "USD",
                                )}`
                              : "Rp 0"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <DataStatusBadge commissionBasis={item.commissionBasis} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.commissionBasis === "ESTIMATED" && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleEstimateBooking(item.bookingId)}
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                                title="Hitung ulang estimasi komisi"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Re-estimasi</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ATURAN KOMISI OTA (S7-01) */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Aturan Komisi OTA (Commission Rules)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi persentase komisi dan model pembayaran default per OTA (S7-01).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddRuleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Aturan Komisi</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Kanal OTA</th>
                    <th className="px-5 py-3">Rate Komisi</th>
                    <th className="px-5 py-3">Model Pembayaran</th>
                    <th className="px-5 py-3">Berlaku Mulai</th>
                    <th className="px-5 py-3">Berlaku Sampai</th>
                    <th className="px-5 py-3">Listing Khusus</th>
                    <th className="px-5 py-3">Catatan</th>
                    <th className="px-5 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commissionRules.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400 italic">
                        Belum ada aturan komisi terdaftar. Klik tombol Tambah Aturan Komisi untuk
                        membuat aturan baru.
                      </td>
                    </tr>
                  ) : (
                    commissionRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">{rule.channel}</td>
                        <td className="px-5 py-3.5 font-semibold text-amber-900">
                          <span className="bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded text-xs">
                            {rule.ratePercentage}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <CollectTypeBadge collectType={rule.collectType} />
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{rule.validFrom}</td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {rule.validTo ?? "Seterusnya"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {rule.listingName ? (
                            <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-medium">
                              {rule.listingName}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Semua listing</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                          {rule.notes ?? "-"}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus aturan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Aturan Komisi */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Aturan Komisi OTA</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tentukan persentase komisi dan model pembayaran default untuk menghitung komisi
              estimasi (S7-01).
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kanal OTA</label>
                <select
                  value={ruleChannel}
                  onChange={(e) => setRuleChannel(e.target.value as ChannelCode)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="AIRBNB">Airbnb</option>
                  <option value="TIKET_COM">Tiket.com</option>
                  <option value="TRAVELOKA">Traveloka</option>
                  <option value="EXPEDIA">Expedia</option>
                  <option value="AGODA">Agoda</option>
                  <option value="BOOKING_COM">Booking.com</option>
                  <option value="DIRECT">Direct / Langsung</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rate Komisi (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={ruleRatePct}
                      onChange={(e) => setRuleRatePct(e.target.value)}
                      placeholder="15.0"
                      className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-bold">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model Pembayaran
                  </label>
                  <select
                    value={ruleCollectType}
                    onChange={(e) => setRuleCollectType(e.target.value as CollectType)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="CHANNEL_COLLECT">Channel Collect (OTA)</option>
                    <option value="HOTEL_COLLECT">Hotel Collect (Properti)</option>
                    <option value="UNKNOWN">Belum Ditentukan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Berlaku Mulai
                  </label>
                  <input
                    type="date"
                    required
                    value={ruleValidFrom}
                    onChange={(e) => setRuleValidFrom(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Berlaku Sampai (Opsional)
                  </label>
                  <input
                    type="date"
                    value={ruleValidTo}
                    onChange={(e) => setRuleValidTo(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Aturan (Opsional)
                </label>
                <input
                  type="text"
                  value={ruleNotes}
                  onChange={(e) => setRuleNotes(e.target.value)}
                  placeholder="Contoh: Kontrak baru komisi split-fee 2026"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
                >
                  {isPending ? "Menyimpan..." : "Simpan Aturan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
