/**
 * Halaman Cetak & PDF Laporan Bulanan Pemilik (S8-01).
 *
 * Dioptimalkan untuk cetak A4 / simpan ke PDF:
 * - Layout resmi korporat Hillside Eden
 * - Header kop surat resmi, tabel data komparatif, dan lembar tanda tangan pengesahan
 * - Styling @media print untuk menghapus elemen navigasi dan mempertahankan kontras cetak
 */
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";
import { formatIDR } from "@/lib/format-id";
import { getMonthlyOwnerReport } from "@/server/queries/reports";

export const metadata = { title: "Cetak Laporan Bulanan Pemilik - Hillside Eden" };
export const instant = false;

interface PrintPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrintReportPage({ searchParams }: PrintPageProps) {
  await connection();
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const now = new Date();
  const year = Number(rawParams.year) || now.getUTCFullYear();
  const month = Number(rawParams.month) || now.getUTCMonth() + 1;
  const propertyId = typeof rawParams.propertyId === "string" ? rawParams.propertyId : null;

  const report = await getMonthlyOwnerReport({
    organizationId: session.user.organizationId,
    propertyId,
    year,
    month,
  });

  const k = report.kpis;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Tombol Aksi Layar (Disembunyikan saat dicetak) */}
      <div className="mx-auto max-w-4xl mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/reports?year=${year}&month=${month}${propertyId ? `&propertyId=${propertyId}` : ""}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Halaman Laporan</span>
        </Link>

        <button
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
        >
          <Printer className="h-4 w-4" />
          <span>Cetak Sekarang / Simpan ke PDF</span>
        </button>
      </div>

      {/* Dokumen Laporan (Kertas A4 Resmi) */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Kop Surat */}
        <div className="border-b-2 border-slate-900 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase">
                Hillside Eden Estate &amp; Ubud Hillside
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Payangan &amp; Bentuyung, Gianyar - Bali, Indonesia · Sistem Monitoring Booking
                &amp; Keuangan
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-md border border-slate-900/20 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800 uppercase">
                {report.lock.isLocked
                  ? "Laporan Terverifikasi (Tutup Buku)"
                  : "Draf Laporan Berjalan"}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Dicetak:{" "}
                {new Date().toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <div>
              <span className="text-slate-500">Periode Pelaporan: </span>
              <strong className="font-bold text-slate-900">{report.periodLabel}</strong>
            </div>
            <div>
              <span className="text-slate-500">Cakupan Properti: </span>
              <strong className="font-bold text-slate-900">{report.propertyFilterName}</strong>
            </div>
            <div>
              <span className="text-slate-500">Mata Uang Dasar: </span>
              <strong className="font-bold text-slate-900">IDR (Rupiah)</strong>
            </div>
          </div>
        </div>

        {/* 1. Ringkasan Finansial Utama */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            1. Ringkasan Finansial &amp; Hasil Operasional
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                Nilai Booking (Gross)
              </p>
              <p className="text-lg font-extrabold text-slate-900 mt-1">{formatIDR(k.gross)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Basis tanggal menginap</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">
                Komisi Saluran OTA
              </p>
              <p className="text-lg font-extrabold text-amber-700 mt-1">
                {formatIDR(k.commission)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {k.effectiveCommissionRate}% komisi efektif
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-emerald-50/30">
              <p className="text-[11px] font-semibold text-emerald-800 uppercase">
                Pendapatan Bersih
              </p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1">{formatIDR(k.net)}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Setelah komisi OTA</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-rose-50/30">
              <p className="text-[11px] font-semibold text-rose-800 uppercase">Beban Operasional</p>
              <p className="text-lg font-extrabold text-rose-700 mt-1">{formatIDR(k.expenses)}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Total pengeluaran bulan</p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Pendapatan Lain</p>
              <p className="text-lg font-extrabold text-slate-900 mt-1">
                {formatIDR(k.otherIncome)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Operasional non-OTA</p>
            </div>
            <div className="p-3.5 rounded-xl border-2 border-slate-900 bg-slate-900 text-white">
              <p className="text-[11px] font-bold text-slate-300 uppercase">Hasil Operasional</p>
              <p className="text-lg font-black text-white mt-1">{formatIDR(k.operationalResult)}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Pendapatan bersih - beban</p>
            </div>
          </div>
        </div>

        {/* Indikator Okupansi */}
        <div className="mt-6 grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Malam Terjual</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{k.soldNights} malam</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Malam Tersedia</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">
              {k.availableNights} malam
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Tingkat Okupansi</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{k.occupancyRate}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Rata-rata ADR</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatIDR(k.adr)}</p>
          </div>
        </div>

        {/* 2. Rincian Saluran OTA */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            2. Rincian Per Saluran Penjualan (OTA)
          </h2>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5 border-b">Saluran</th>
                <th className="p-2.5 border-b text-center">Jml Booking</th>
                <th className="p-2.5 border-b text-right">Nilai Gross</th>
                <th className="p-2.5 border-b text-right">Komisi OTA</th>
                <th className="p-2.5 border-b text-right">Pendapatan Bersih</th>
                <th className="p-2.5 border-b text-center">% Efektif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.channels.map((c) => (
                <tr key={c.channel}>
                  <td className="p-2.5 font-bold text-slate-900">{c.channel}</td>
                  <td className="p-2.5 text-center">{c.bookingCount}</td>
                  <td className="p-2.5 text-right font-semibold">{formatIDR(c.gross)}</td>
                  <td className="p-2.5 text-right text-amber-700">{formatIDR(c.commission)}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-700">
                    {formatIDR(c.net)}
                  </td>
                  <td className="p-2.5 text-center font-medium">{c.effectiveRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. Rincian Beban Operasional */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            3. Rincian Beban Operasional Per Kategori
          </h2>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5 border-b">Kategori Pengeluaran</th>
                <th className="p-2.5 border-b text-center">Transaksi</th>
                <th className="p-2.5 border-b text-right">Jumlah Beban</th>
                <th className="p-2.5 border-b text-center">Porsi (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.expenseCategories.map((exp) => (
                <tr key={exp.categoryCode}>
                  <td className="p-2.5 font-semibold text-slate-800">{exp.categoryName}</td>
                  <td className="p-2.5 text-center text-slate-600">{exp.entryCount}</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">
                    {formatIDR(exp.amount)}
                  </td>
                  <td className="p-2.5 text-center text-slate-600 font-medium">
                    {exp.percentageOfTotal}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Rincian Kinerja Per Properti */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            4. Kinerja Komparatif Antar Properti
          </h2>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2.5 border-b">Nama Properti</th>
                <th className="p-2.5 border-b text-right">Nilai Gross</th>
                <th className="p-2.5 border-b text-right">Pendapatan Bersih</th>
                <th className="p-2.5 border-b text-right">Beban Operasional</th>
                <th className="p-2.5 border-b text-right">Hasil Operasional</th>
                <th className="p-2.5 border-b text-center">Okupansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.properties.map((p) => (
                <tr key={p.propertyId}>
                  <td className="p-2.5 font-bold text-slate-900">{p.propertyName}</td>
                  <td className="p-2.5 text-right font-semibold">{formatIDR(p.gross)}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-700">
                    {formatIDR(p.net)}
                  </td>
                  <td className="p-2.5 text-right text-rose-700">{formatIDR(p.expenses)}</td>
                  <td className="p-2.5 text-right font-black text-slate-900">
                    {formatIDR(p.operationalResult)}
                  </td>
                  <td className="p-2.5 text-center font-bold">{p.occupancyRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Variansi Pasca-Tutup Buku bila ada */}
        {report.lock.isLocked && report.lock.variance?.hasVariance && (
          <div className="mt-8 p-4 rounded-xl border border-amber-300 bg-amber-50/50">
            <h3 className="text-xs font-bold text-amber-900 uppercase">
              Catatan: Selisih Sejak Penutupan Periode (Pasca-Tutup Buku)
            </h3>
            <p className="text-[11px] text-amber-700 mt-1">
              Data transaksi mengalami penyesuaian setelah periode ini ditutup. Selisih bersih hasil
              operasional saat ini adalah{" "}
              <strong>{formatIDR(report.lock.variance.operationalResultDiff)}</strong> terhadap
              snapshot penutupan.
            </p>
          </div>
        )}

        {/* Lembar Tanda Tangan */}
        <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <p className="text-slate-500">Disiapkan dan Diverifikasi oleh,</p>
            <div className="h-20" />
            <p className="font-bold text-slate-900 border-t border-slate-300 inline-block px-8 pt-1">
              General Manager / Pengelola
            </p>
          </div>
          <div>
            <p className="text-slate-500">Disetujui dan Diterima oleh,</p>
            <div className="h-20" />
            <p className="font-bold text-slate-900 border-t border-slate-300 inline-block px-8 pt-1">
              Pemilik Villa (Owner)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
