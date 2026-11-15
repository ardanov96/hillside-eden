#!/usr/bin/env tsx
/**
 * Rotasi kunci enkripsi `IcalFeed.urlEncrypted` (ADR-031).
 *
 * Latar belakang: URL iCal pernah dienkripsi dengan kunci turunan
 * `AUTH_SECRET`. Sejak `ENCRYPTION_KEY` menjadi wajib di produksi, nilai yang
 * tersimpan harus dienkripsi ulang memakai kunci baru.
 *
 * Cara pakai:
 *   ENCRYPTION_KEY_OLD=<kunci-lama> ENCRYPTION_KEY=<kunci-baru> \
 *     pnpm encrypt:rotate            # dry-run: hanya laporan, DB tidak diubah
 *   ENCRYPTION_KEY_OLD=<kunci-lama> ENCRYPTION_KEY=<kunci-baru> \
 *     pnpm encrypt:rotate --apply    # menulis perubahan ke DB
 *
 * Catatan keamanan:
 * - Kedua kunci wajib diisi (minimal 32 karakter).
 * - Semua baris diverifikasi (dekripsi ketat) SEBELUM ada penulisan; bila satu
 *   baris gagal didekripsi, proses berhenti tanpa mengubah data.
 * - Baris yang bukan ciphertext (URL legacy plaintext) ikut dienkripsi.
 * - Skrip tidak menyentuh data keuangan; hanya kolom `IcalFeed.urlEncrypted`.
 */
import { PrismaClient } from "@prisma/client";
import {
  decryptTextWithKey,
  deriveEncryptionKey,
  encryptTextWithKey,
  ENCRYPTION_KEY_MIN_LENGTH,
} from "../src/lib/crypto";

export interface IcalFeedRow {
  id: string;
  listingId: string;
  urlEncrypted: string;
}

export interface PlannedRotation {
  id: string;
  listingId: string;
  kind: "cipher" | "legacy-plaintext" | "empty";
  newValue: string;
}

export interface RotationPlan {
  planned: PlannedRotation[];
  failures: string[];
}

/** Apakah nilai tersimpan berformat ciphertext `ivHex:authTagHex:dataHex`. */
export function looksLikeCipher(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[0-9a-f]+$/i.test(p));
}

/**
 * Susun rencana rotasi tanpa menyentuh database.
 * Semua baris diverifikasi lebih dulu; bila ada yang gagal didekripsi, hasilnya
 * dilaporkan di `failures` dan pemanggil harus membatalkan penulisan.
 */
export function planRotation(
  rows: readonly IcalFeedRow[],
  oldKey: Buffer,
  newKey: Buffer,
): RotationPlan {
  const planned: PlannedRotation[] = [];
  const failures: string[] = [];

  for (const row of rows) {
    const value = row.urlEncrypted ?? "";

    if (value.length === 0) {
      planned.push({ id: row.id, listingId: row.listingId, kind: "empty", newValue: value });
      continue;
    }

    if (!looksLikeCipher(value)) {
      // Legacy: URL plaintext tersimpan apa adanya → enkripsi ulang.
      planned.push({
        id: row.id,
        listingId: row.listingId,
        kind: "legacy-plaintext",
        newValue: encryptTextWithKey(value, newKey),
      });
      continue;
    }

    try {
      const plain = decryptTextWithKey(value, oldKey);
      planned.push({
        id: row.id,
        listingId: row.listingId,
        kind: "cipher",
        newValue: encryptTextWithKey(plain, newKey),
      });
    } catch (err) {
      failures.push(`${row.id} (listing ${row.listingId}): ${(err as Error).message}`);
    }
  }

  return { planned, failures };
}

function readKey(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} wajib diisi untuk rotasi kunci.`);
  }
  if (value.length < ENCRYPTION_KEY_MIN_LENGTH) {
    throw new Error(`${name} terlalu pendek (minimal ${ENCRYPTION_KEY_MIN_LENGTH} karakter).`);
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient();
  const apply = process.argv.slice(2).includes("--apply");

  try {
    const oldSecret = readKey("ENCRYPTION_KEY_OLD");
    const newSecret = readKey("ENCRYPTION_KEY");
    if (oldSecret === newSecret) {
      throw new Error(
        "ENCRYPTION_KEY_OLD dan ENCRYPTION_KEY identik — tidak ada yang perlu dirotasi.",
      );
    }

    const oldKey = deriveEncryptionKey(oldSecret);
    const newKey = deriveEncryptionKey(newSecret);

    const feeds = await prisma.icalFeed.findMany({
      select: { id: true, listingId: true, urlEncrypted: true },
      orderBy: { id: "asc" },
    });

    console.log(`[rotate] jumlah IcalFeed: ${feeds.length}`);
    console.log(`[rotate] mode: ${apply ? "APPLY (menulis DB)" : "DRY-RUN (tidak menulis)"}`);

    if (feeds.length === 0) {
      console.log("[rotate] tidak ada data iCal yang perlu dirotasi.");
      return;
    }

    // Fase 1: verifikasi SEMUA baris sebelum ada penulisan.
    const { planned, failures } = planRotation(feeds, oldKey, newKey);

    if (failures.length > 0) {
      console.error("[rotate] GAGAL: baris berikut tidak dapat didekripsi dengan kunci LAMA:");
      for (const f of failures) console.error(`  - ${f}`);
      console.error("[rotate] tidak ada perubahan yang ditulis. Periksa ENCRYPTION_KEY_OLD.");
      process.exitCode = 1;
      return;
    }

    for (const row of planned) {
      console.log(`  - ${row.id} (listing ${row.listingId}) [${row.kind}]`);
    }

    if (!apply) {
      console.log("[rotate] dry-run selesai. Jalankan ulang dengan --apply untuk menulis.");
      return;
    }

    // Fase 2: tulis (transaksi) lalu verifikasi ulang dengan kunci baru.
    await prisma.$transaction(
      planned.map((row) =>
        prisma.icalFeed.update({
          where: { id: row.id },
          data: { urlEncrypted: row.newValue },
        }),
      ),
    );

    const after = await prisma.icalFeed.findMany({
      select: { id: true, urlEncrypted: true },
    });
    for (const row of after) {
      if (!looksLikeCipher(row.urlEncrypted)) continue;
      decryptTextWithKey(row.urlEncrypted, newKey);
    }

    console.log(
      `[rotate] selesai: ${planned.length} baris ditulis & diverifikasi dengan kunci baru.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[rotate] gagal:", err);
    process.exitCode = 1;
  });
}
