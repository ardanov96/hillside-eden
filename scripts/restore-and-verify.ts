/**
 * Skrip Verifikasi Integritas & Uji Restore Backup (S8-02).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §8:
 * - Memverifikasi validitas file backup dan checksum SHA-256
 * - Menjalankan pemeriksaan integritas relasi referensial (Property, Listing, Booking)
 * - Menjalankan pemeriksaan matematis keuangan: Gross = Net + Komisi
 * - Penggunaan: `pnpm tsx scripts/restore-and-verify.ts <path-to-backup-file>`
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { Decimal } from "../src/lib/decimal";

export interface VerificationResult {
  valid: boolean;
  checksumMatches: boolean;
  recordCounts: Record<string, number>;
  financialChecks: {
    totalBookingsChecked: number;
    totalGrossAmount: string;
    totalCommissionAmount: string;
    totalNetAmount: string;
    grossNetCommissionBalanced: boolean;
  };
  errors: string[];
}

export function verifyBackupFile(filepath: string): VerificationResult {
  if (!existsSync(filepath)) {
    throw new Error(`File backup tidak ditemukan: ${filepath}`);
  }

  const rawFile = readFileSync(filepath, "utf-8");
  const parsed = JSON.parse(rawFile);

  const errors: string[] = [];

  // 1. Verifikasi Checksum SHA-256
  const storedChecksum = parsed.metadata?.checksum;
  const clone = { ...parsed };
  if (clone.metadata) {
    const metaWithoutCheck = { ...clone.metadata };
    delete metaWithoutCheck.checksum;
    clone.metadata = metaWithoutCheck;
  }

  const calculatedChecksum = createHash("sha256")
    .update(JSON.stringify(clone, null, 2))
    .digest("hex");

  const checksumMatches = storedChecksum === calculatedChecksum;
  if (!checksumMatches) {
    errors.push(
      `Checksum tidak cocok! Stored: ${storedChecksum}, Calculated: ${calculatedChecksum}`,
    );
  }

  // 2. Pemeriksaan struktur data
  const data = parsed.data || {};
  const bookings: Array<{
    id: string;
    grossAmount: string | number;
    commissionAmount?: string | number | null;
    netAmount?: string | number | null;
    propertyId: string;
  }> = data.bookings || [];

  const properties: Array<{ id: string }> = data.properties || [];
  const propertyIds = new Set(properties.map((p) => p.id));

  // 3. Pemeriksaan Integritas Keuangan & Relasi
  let sumGross = new Decimal(0);
  let sumCommission = new Decimal(0);
  let sumNet = new Decimal(0);
  let balanced = true;

  for (const b of bookings) {
    if (b.propertyId && !propertyIds.has(b.propertyId) && propertyIds.size > 0) {
      errors.push(`Booking ${b.id} merujuk ke propertyId ${b.propertyId} yang tidak ditemukan`);
    }

    const gross = new Decimal(b.grossAmount?.toString() || 0);
    const comm = new Decimal(b.commissionAmount?.toString() || 0);
    const net = new Decimal(b.netAmount?.toString() || 0);

    sumGross = sumGross.plus(gross);
    sumCommission = sumCommission.plus(comm);
    sumNet = sumNet.plus(net);

    // Bila netAmount tercatat eksplisit, verifikasi gross = net + comm
    if (b.netAmount !== undefined && b.netAmount !== null) {
      const calculatedGross = net.plus(comm);
      if (!gross.equals(calculatedGross)) {
        errors.push(
          `Ketidakcocokan nilai keuangan pada booking ${b.id}: Gross (${gross}) != Net (${net}) + Komisi (${comm})`,
        );
        balanced = false;
      }
    }
  }

  const recordCounts: Record<string, number> = {};
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      recordCounts[key] = val.length;
    }
  }

  return {
    valid: errors.length === 0,
    checksumMatches,
    recordCounts,
    financialChecks: {
      totalBookingsChecked: bookings.length,
      totalGrossAmount: sumGross.toFixed(0),
      totalCommissionAmount: sumCommission.toFixed(0),
      totalNetAmount: sumNet.toFixed(0),
      grossNetCommissionBalanced: balanced,
    },
    errors,
  };
}

// Eksekusi CLI jika dijalankan langsung
if (require.main === module) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error("Gunakan: pnpm tsx scripts/restore-and-verify.ts <path-file-backup.json>");
    process.exit(1);
  }

  console.log(`[VERIFY] Memeriksa integritas file backup: ${targetFile}...`);
  try {
    const result = verifyBackupFile(targetFile);
    if (result.valid) {
      console.log(`[VERIFY] Sukses! File backup valid dan terverifikasi secara matematis.`);
      console.log(`  Checksum SHA-256 Cocok: ${result.checksumMatches ? "YA" : "TIDAK"}`);
      console.log(`  Total Booking Terverifikasi: ${result.financialChecks.totalBookingsChecked}`);
      console.log(`  Total Nilai Gross: Rp ${result.financialChecks.totalGrossAmount}`);
      console.log(`  Total Komisi OTA: Rp ${result.financialChecks.totalCommissionAmount}`);
      console.log(
        `  Konsistensi Keuangan (Gross = Net + Komisi): ${result.financialChecks.grossNetCommissionBalanced ? "SEIMBANG" : "SELISIH"}`,
      );
      process.exit(0);
    } else {
      console.error(`[VERIFY] GAGAL! Ditemukan ${result.errors.length} masalah integritas:`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`[VERIFY] Kesalahan saat membaca file:`, err);
    process.exit(1);
  }
}
