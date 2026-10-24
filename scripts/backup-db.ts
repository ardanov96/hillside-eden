/**
 * Skrip Backup Logis Database & Integritas Data (S8-02).
 *
 * Mengikuti spesifikasi docs/08-quality-security-ops.md §8 & OD-14:
 * - Ekspor logis tabel-tabel transaksional dan master ke format JSON berstruktur
 * - Menghasilkan checksum SHA-256 untuk verifikasi integritas
 * - Menyimpan metadata waktu, total baris per tabel, dan organisasi
 * - Penggunaan: `pnpm tsx scripts/backup-db.ts [output-dir]`
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

export interface BackupMetadata {
  version: "1.0.0";
  timestamp: string;
  organizationId?: string;
  recordCounts: Record<string, number>;
  checksum: string;
}

export interface BackupPayload {
  metadata: Omit<BackupMetadata, "checksum">;
  data: {
    organizations: unknown[];
    properties: unknown[];
    units: unknown[];
    listings: unknown[];
    commissionRules: unknown[];
    bookings: unknown[];
    bookingEvents: unknown[];
    payouts: unknown[];
    payoutBookings: unknown[];
    expenses: unknown[];
    expenseAllocations: unknown[];
    periodLocks: unknown[];
    auditLogs: unknown[];
  };
}

export async function createDatabaseBackup(outputDir = "backups"): Promise<{
  filepath: string;
  checksum: string;
  recordCounts: Record<string, number>;
}> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 1. Ekspor data dari semua tabel inti
  const [
    organizations,
    properties,
    units,
    listings,
    commissionRules,
    bookings,
    bookingEvents,
    payouts,
    payoutBookings,
    expenses,
    expenseAllocations,
    periodLocks,
    auditLogs,
  ] = await Promise.all([
    prisma.organization.findMany(),
    prisma.property.findMany(),
    prisma.unit.findMany(),
    prisma.listing.findMany(),
    prisma.commissionRule.findMany(),
    prisma.booking.findMany(),
    prisma.bookingEvent.findMany(),
    prisma.payout.findMany(),
    prisma.payoutBooking.findMany(),
    prisma.expense.findMany(),
    prisma.expenseAllocation.findMany(),
    prisma.periodLock.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const recordCounts: Record<string, number> = {
    organizations: organizations.length,
    properties: properties.length,
    units: units.length,
    listings: listings.length,
    commissionRules: commissionRules.length,
    bookings: bookings.length,
    bookingEvents: bookingEvents.length,
    payouts: payouts.length,
    payoutBookings: payoutBookings.length,
    expenses: expenses.length,
    expenseAllocations: expenseAllocations.length,
    periodLocks: periodLocks.length,
    auditLogs: auditLogs.length,
  };

  const payload: BackupPayload = {
    metadata: {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      organizationId: organizations[0]?.id,
      recordCounts,
    },
    data: {
      organizations,
      properties,
      units,
      listings,
      commissionRules,
      bookings,
      bookingEvents,
      payouts,
      payoutBookings,
      expenses,
      expenseAllocations,
      periodLocks,
      auditLogs,
    },
  };

  const rawJson = JSON.stringify(payload, null, 2);
  const checksum = createHash("sha256").update(rawJson).digest("hex");

  const fullBackup = {
    ...payload,
    metadata: {
      ...payload.metadata,
      checksum,
    },
  };

  const nowStr = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-hillside-eden-${nowStr}.json`;
  const filepath = path.join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(fullBackup, null, 2), "utf-8");

  return { filepath, checksum, recordCounts };
}

// Eksekusi CLI jika dijalankan langsung
if (require.main === module) {
  const targetDir = process.argv[2] || "backups";
  console.log(`[BACKUP] Memulai proses backup database ke folder '${targetDir}'...`);

  createDatabaseBackup(targetDir)
    .then((result) => {
      console.log(`[BACKUP] Selesai berhasil!`);
      console.log(`  File: ${result.filepath}`);
      console.log(`  SHA-256: ${result.checksum}`);
      console.log(`  Ringkasan data:`);
      for (const [table, count] of Object.entries(result.recordCounts)) {
        console.log(`    - ${table}: ${count} baris`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[BACKUP] Gagal membuat backup:`, err);
      process.exit(1);
    });
}
