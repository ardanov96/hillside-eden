import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMonthlyOwnerReport } from "@/server/queries/reports";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getUTCFullYear();
  const month = Number(searchParams.get("month")) || now.getUTCMonth() + 1;
  const propertyId = searchParams.get("propertyId") || null;

  const report = await getMonthlyOwnerReport({
    organizationId: session.user.organizationId,
    propertyId,
    year,
    month,
  });

  const k = report.kpis;

  // Bangun konten CSV terstruktur dengan BOM UTF-8 (\uFEFF) untuk kompatibilitas Excel
  const lines: string[] = [];

  // Metadata Laporan
  lines.push(`"LAPORAN BULANAN PEMILIK - HILLSIDE EDEN"`);
  lines.push(`"Periode","${report.periodLabel}"`);
  lines.push(`"Filter Properti","${report.propertyFilterName}"`);
  lines.push(
    `"Status Periode","${report.lock.isLocked ? "TERKUNCI (Tutup Buku)" : "TERBUKA (Draf Berjalan)"}"`,
  );
  if (report.lock.isLocked && report.lock.lockedAt) {
    lines.push(`"Waktu Tutup Buku","${report.lock.lockedAt}"`);
  }
  lines.push(`"Tanggal Unduh","${new Date().toISOString()}"`);
  lines.push("");

  // Bagian 1: Ringkasan Eksekutif
  lines.push(`"=== 1. RINGKASAN KEUANGAN & KPI ==="`);
  lines.push(`"Indikator","Nilai (IDR / Angka)","Keterangan"`);
  lines.push(`"Nilai booking (gross)",${k.gross},"Total nilai reservasi stay-basis"`);
  lines.push(`"Komisi OTA",${k.commission},"Estimasi / aktual komisi potongan saluran"`);
  lines.push(`"Pendapatan bersih (setelah komisi OTA)",${k.net},"Gross dikurangi komisi OTA"`);
  lines.push(
    `"Beban Operasional Standar",${k.expenses},"Total pengeluaran operasional terverifikasi"`,
  );
  lines.push(`"Pendapatan Lain",${k.otherIncome},"Pemasukan operasional non-OTA"`);
  lines.push(
    `"Hasil operasional",${k.operationalResult},"Pendapatan bersih + pendapatan lain - beban"`,
  );
  lines.push(`"Malam Terjual (Room Nights Sold)",${k.soldNights},"Malam menginap terkonfirmasi"`);
  lines.push(
    `"Malam Tersedia (Room Nights Available)",${k.availableNights},"Kapasitas kamar x hari bulan"`,
  );
  lines.push(`"Tingkat Okupansi (%)","${k.occupancyRate}%","Malam terjual / malam tersedia"`);
  lines.push(`"Average Daily Rate (ADR)",${k.adr},"Gross / malam terjual"`);
  lines.push(`"RevPAR",${k.revpar},"Gross / malam tersedia"`);
  lines.push("");

  // Bagian 2: Rincian Saluran OTA
  lines.push(`"=== 2. RINCIAN SALURAN OTA ==="`);
  lines.push(
    `"Saluran OTA","Jumlah Booking","Nilai Gross (IDR)","Komisi OTA (IDR)","Pendapatan Bersih (IDR)","% Komisi Efektif","Status Data"`,
  );
  for (const c of report.channels) {
    lines.push(
      `"${c.channel}",${c.bookingCount},${c.gross},${c.commission},${c.net},"${c.effectiveRate}%","${c.hasEstimated ? "Estimasi" : "Aktual"}"`,
    );
  }
  lines.push("");

  // Bagian 3: Rincian Pengeluaran per Kategori
  lines.push(`"=== 3. RINCIAN BEBAN OPERASIONAL PER KATEGORI ==="`);
  lines.push(
    `"Kode Kategori","Nama Kategori","Total Beban (IDR)","% dari Total Beban","Jumlah Transaksi","Status"`,
  );
  for (const exp of report.expenseCategories) {
    lines.push(
      `"${exp.categoryCode}","${exp.categoryName}",${exp.amount},"${exp.percentageOfTotal}%",${exp.entryCount},"${exp.hasDrafts ? "Ada Draf" : "Terverifikasi"}"`,
    );
  }
  lines.push("");

  // Bagian 4: Rincian per Properti
  lines.push(`"=== 4. RINCIAN KINERJA PER PROPERTI ==="`);
  lines.push(
    `"Nama Properti","Nilai Gross (IDR)","Pendapatan Bersih (IDR)","Beban (IDR)","Hasil Operasional (IDR)","Malam Terjual","Okupansi (%)","ADR (IDR)"`,
  );
  for (const p of report.properties) {
    lines.push(
      `"${p.propertyName}",${p.gross},${p.net},${p.expenses},${p.operationalResult},${p.soldNights},"${p.occupancyRate}%",${p.adr}`,
    );
  }
  lines.push("");

  // Bagian 5: Variansi sejak penutupan (bila periode terkunci dan ada variansi)
  if (report.lock.isLocked && report.lock.variance?.hasVariance) {
    const v = report.lock.variance;
    lines.push(`"=== 5. SELISIH SEJAK PENUTUPAN (VARIANSI PASCA-TUTUP BUKU) ==="`);
    lines.push(`"Metrik","Nilai Selisih (IDR)"`);
    lines.push(`"Selisih Nilai Gross",${v.grossDiff}`);
    lines.push(`"Selisih Komisi OTA",${v.commissionDiff}`);
    lines.push(`"Selisih Pendapatan Bersih",${v.netDiff}`);
    lines.push(`"Selisih Beban Operasional",${v.expensesDiff}`);
    lines.push(`"Selisih Hasil Operasional",${v.operationalResultDiff}`);
    lines.push("");
  }

  const csvContent = "\uFEFF" + lines.join("\r\n");

  const filename = `laporan-pemilik-${report.period}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
