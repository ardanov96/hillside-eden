/**
 * Seed data dummy sintetis - S1-06.
 *
 * MengISI tabel transaksional (Booking, BookingUnit, BookingEvent, Payout,
 * Expense) dengan data berlabel untuk mengisi dashboard saat pengembangan.
 * Data master (Organization, Property, Unit, Listing, InventoryConfig,
 * ExpenseCategory, AllocationRule) TIDAK disentuh - itu milik `prisma/seed.ts`.
 *
 * Cara pakai:
 *   pnpm db:seed        # master data (WAJIB lebih dulu)
 *   pnpm db:seed:dummy  # data dummy (idempoten, aman diulang)
 *
 * Pengaman: skrip ini menolak jalan bila target-nya dianggap produksi
 * (NODE_ENV=production, atau DATABASE_URL sama dengan PROD_DATABASE_URL).
 * Housing database saat ini adalah Neon, jadi satu perintah salah ketik bisa
 * mengisi database cloud. Lihat docs/briefs/od-01-neon-branches.md bagian 6.
 *
 * Idempoten: sebelum menulis, seluruh baris dummy yang ada dihapus berdasarkan
 * penanda DUMMY (externalId / filename / description berawalan "DUMMY").
 * Baris non-dummy (mis. hasil impor CSV asli) tidak pernah tersentuh.
 *
 * Determinisme: generator memakai PRNG ber-seed tetap, sehingga run ulang pada
 * hari yang sama menghasilkan data yang sama persis (lihat src/dev/dummy-data.ts).
 *
 * CATATAN PENTING: seluruh nilai di sini adalah ASUMSI DUMMY, bukan data client.
 * Rate komisi dan kurs USD->IDR sengaja ditandai agar tidak tertukar dengan
 * angka aktual (lihat docs/DECISIONS.md).
 */
import { PrismaClient, ChannelCode } from "@prisma/client";
import { todayInWITA } from "../src/lib/dates";
import {
  DEFAULT_DUMMY_SEED,
  DUMMY_ACTOR,
  DUMMY_EXTERNAL_PREFIX,
  DUMMY_MARKER,
  generateDummyDataset,
  stayDateToDate,
  type DummyChannel,
  type DummyGeneratorRefs,
  type DummyListingRef,
  type DummyUnitRef,
} from "../src/dev/dummy-data";

/**
 * Tolak jalan bila targetdatabase adalah produksi.
 *
 * Catatan: nama branch Neon tidak pernah muncul di hostname (formatnya
 * `ep-<slug>-<hash>.<region>.aws.neon.tech`), jadi deteksi berbasis nama
 * tidak mungkin dilakukan. Yang dipakai hanya dua sinyal yang memang
 * tersedia: `NODE_ENV` dan kesamaan dengan `PROD_DATABASE_URL`.
 */
function assertDummyTargetIsSafe(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isProductionEnv = process.env.NODE_ENV === "production";
  const isKnownProd =
    Boolean(process.env.PROD_DATABASE_URL) && dbUrl === process.env.PROD_DATABASE_URL;

  if (isProductionEnv || isKnownProd) {
    console.error("[seed-dummy] DITOLAK: target dianggap produksi.");
    if (isProductionEnv) console.error("  Alasan: NODE_ENV=production.");
    if (isKnownProd) console.error("  Alasan: DATABASE_URL sama dengan PROD_DATABASE_URL.");
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(dbUrl).host;
    } catch {
      return "(tidak terbaca)";
    }
  })();
  console.warn(`[seed-dummy] Menulis ke host: ${host}. Pastikan ini branch dev.`);
}

assertDummyTargetIsSafe();

const prisma = new PrismaClient();

const ORG_ID = "seed-organization";
const DUMMY_FILE_PREFIX = "dummy/";
const DUMMY_DESC_PREFIX = `[${DUMMY_MARKER}]`;

/** Asumsi rate komisi dummy per OTA. BUKAN rate kontrak sebenarnya (OD-10/OD-11). */
const DUMMY_COMMISSION_RATES: Record<DummyChannel, string> = {
  AIRBNB: "0.1400",
  TIKET_COM: "0.1500",
  TRAVELOKA: "0.1300",
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const CHUNK = 500;

// ---------------------------------------------------------------------------
// 1. Baca data master hasil prisma/seed.ts
// ---------------------------------------------------------------------------

async function loadRefs(): Promise<DummyGeneratorRefs> {
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) {
    throw new Error(
      `Organization "${ORG_ID}" belum ada. Jalankan \`pnpm db:seed\` lebih dulu sebelum \`pnpm db:seed:dummy\`.`,
    );
  }

  const properties = await prisma.property.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    orderBy: { slug: "asc" },
    include: {
      units: { orderBy: { name: "asc" } },
      listings: {
        include: { listingUnits: true },
        orderBy: { channel: "asc" },
      },
    },
  });
  if (properties.length === 0) {
    throw new Error("Belum ada Property. Jalankan `pnpm db:seed` lebih dulu.");
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { code: "asc" },
  });
  if (categories.length === 0) {
    throw new Error("Belum ada ExpenseCategory. Jalankan `pnpm db:seed` lebih dulu.");
  }

  const units: DummyUnitRef[] = [];
  const listings: DummyListingRef[] = [];

  for (const prop of properties) {
    // Hanya unit sellable yang boleh dipakai generator (kamar 3 & 4 Ubud tidak sellable).
    const sellableUnitIds = new Set<string>();
    for (const listing of prop.listings) {
      for (const lu of listing.listingUnits) sellableUnitIds.add(lu.unitId);
    }
    for (const unit of prop.units) {
      if (!sellableUnitIds.has(unit.id)) continue;
      units.push({
        unitId: unit.id,
        propertyId: prop.id,
        name: unit.name,
        baseRate: (unit.baseRate ?? 0).toString(10),
        maxGuests: unit.maxGuests,
      });
    }
    for (const listing of prop.listings) {
      // Listing isActive=false hanya berarti sinkronisasi dari OTA dimatikan
      // (menunggu verifikasi akses extranet, OD-10/OD-11). Data dummy tetap
      // memakainya supaya ketiga OTA tercakup di dashboard.
      const channel = listing.channel as DummyChannel;
      listings.push({
        listingId: listing.id,
        propertyId: prop.id,
        channel,
        currency: listing.currency === "USD" ? "USD" : "IDR",
        unitIds: listing.listingUnits.map((lu) => lu.unitId),
        commissionRate: DUMMY_COMMISSION_RATES[channel],
      });
    }
  }

  if (units.length === 0 || listings.length === 0) {
    throw new Error("Belum ada Unit sellable / Listing aktif. Jalankan `pnpm db:seed` dulu.");
  }

  return {
    units,
    listings,
    categories: categories.map((c) => ({ id: c.id, code: c.code })),
    propertyIds: properties.map((p) => p.id),
  };
}

// ---------------------------------------------------------------------------
// 2. Bersihkan data dummy lama (idempotensi) - hanya baris berpenanda DUMMY
// ---------------------------------------------------------------------------

async function wipeDummy() {
  const bk = { externalId: { startsWith: DUMMY_EXTERNAL_PREFIX } };

  // Urutan mengikuti dependensi FK (anak lebih dulu).
  const bookingEvents = await prisma.bookingEvent.deleteMany({ where: { booking: bk } });
  const payoutBookings = await prisma.payoutBooking.deleteMany({ where: { booking: bk } });
  const bookingUnits = await prisma.bookingUnit.deleteMany({ where: { booking: bk } });
  const bookings = await prisma.booking.deleteMany({ where: bk });
  const payouts = await prisma.payout.deleteMany({
    where: { reference: { startsWith: DUMMY_EXTERNAL_PREFIX } },
  });
  const importItems = await prisma.importItem.deleteMany({
    where: { batch: { filename: { startsWith: DUMMY_FILE_PREFIX } } },
  });
  const importBatches = await prisma.importBatch.deleteMany({
    where: { filename: { startsWith: DUMMY_FILE_PREFIX } },
  });
  const expenses = await prisma.expense.deleteMany({
    where: { description: { startsWith: DUMMY_DESC_PREFIX } },
  });

  return {
    bookingEvents,
    payoutBookings,
    bookingUnits,
    bookings,
    payouts,
    importItems,
    importBatches,
    expenses,
  };
}

// ---------------------------------------------------------------------------
// 3. Tulis data dummy
// ---------------------------------------------------------------------------

async function write(data: ReturnType<typeof generateDummyDataset>, seed: number) {
  const rawPayload = {
    synthetic: true,
    marker: DUMMY_MARKER,
    generator: "prisma/seed-dummy.ts",
    seed,
  };

  // 3a. ImportBatch
  const batchIdByKey = new Map<string, string>();
  for (const batch of data.importBatches) {
    const created = await prisma.importBatch.create({
      data: {
        organizationId: ORG_ID,
        kind: batch.kind,
        channel: batch.channel as ChannelCode,
        filename: batch.filename,
        stats: { marker: DUMMY_MARKER, seed },
      },
    });
    batchIdByKey.set(batch.key, created.id);
  }

  // 3b. Booking
  const bookingIdByExternalId = new Map<string, string>();
  for (const rows of chunk(data.bookings, CHUNK)) {
    const created = await prisma.booking.createManyAndReturn({
      data: rows.map((b) => ({
        organizationId: ORG_ID,
        propertyId: b.propertyId,
        listingId: b.listingId,
        channel: b.channel as ChannelCode,
        externalId: b.externalId,
        status: b.status,
        bookedAt: new Date(b.bookedAt),
        checkIn: stayDateToDate(b.checkIn),
        checkOut: stayDateToDate(b.checkOut),
        nights: b.nights,
        guestsCount: b.guestsCount,
        currency: b.currency,
        grossAmount: b.grossAmount,
        taxesCollected: b.taxesCollected,
        cancellationFee: b.cancellationFee,
        commissionAmount: b.commissionAmount,
        commissionRate: b.commissionRate,
        commissionBasis: b.commissionBasis,
        collectType: b.collectType,
        fxRateToBase: b.fxRateToBase,
        fxRateSource: b.fxRateSource,
        rawPayload,
        importBatchId: batchIdByKey.get(b.importBatchKey),
      })),
      select: { id: true, externalId: true },
    });
    for (const row of created) bookingIdByExternalId.set(row.externalId, row.id);
  }

  // 3c. BookingUnit (FK ke Booking; require mapping id)
  const bookingUnits = data.bookings.flatMap((b) => {
    const bookingId = bookingIdByExternalId.get(b.externalId);
    if (!bookingId) return [];
    return b.units.map((u) => ({
      bookingId,
      unitId: u.unitId,
      allocatedGross: u.allocatedGross,
      allocationPct: u.allocationPct,
    }));
  });
  for (const rows of chunk(bookingUnits, CHUNK)) {
    await prisma.bookingUnit.createMany({ data: rows });
  }

  // 3d. ImportItem (satu item per booking, contentHash unik per batch)
  const importItems = data.importItems.flatMap((i) => {
    const batchId = batchIdByKey.get(i.batchKey);
    const booking = data.bookings.find((b) => b.externalId === i.bookingExternalId);
    if (!batchId || !booking) return [];
    return [
      {
        batchId,
        status: i.status,
        contentHash: i.contentHash,
        rawRef: `dummy://${booking.externalId}`,
        parsedPayload: rawPayload as object,
      },
    ];
  });
  const importItemIdByBookingExternalId = new Map<string, string>();
  {
    const rows = chunk(importItems, CHUNK);
    for (const batchRows of rows) {
      const created = await prisma.importItem.createManyAndReturn({
        data: batchRows,
        select: { id: true, rawRef: true },
      });
      for (const row of created) {
        const externalId = String(row.rawRef).replace("dummy://", "");
        importItemIdByBookingExternalId.set(externalId, row.id);
      }
    }
  }

  // 3e. BookingEvent
  const events = data.events.flatMap((e) => {
    const bookingId = bookingIdByExternalId.get(e.bookingExternalId);
    if (!bookingId) return [];
    return [
      {
        bookingId,
        type: e.type,
        occurredAt: new Date(e.occurredAt),
        diff: e.diff === null ? undefined : (e.diff as object),
        importItemId: importItemIdByBookingExternalId.get(e.bookingExternalId),
      },
    ];
  });
  for (const rows of chunk(events, CHUNK)) {
    await prisma.bookingEvent.createMany({ data: rows });
  }

  // 3f. Payout + PayoutBooking
  for (const plan of data.payouts) {
    const bookingRows = plan.items.flatMap((it) => {
      const bookingId = bookingIdByExternalId.get(it.bookingExternalId);
      return bookingId ? [{ bookingId, amount: it.amount }] : [];
    });
    const payout = await prisma.payout.create({
      data: {
        organizationId: ORG_ID,
        channel: plan.channel as ChannelCode,
        payoutDate: stayDateToDate(plan.payoutDate),
        currency: plan.currency,
        amount: plan.amount,
        reference: plan.reference,
        bookings: {
          create: bookingRows,
        },
      },
    });
    void payout.id;
  }

  // 3g. Expense + ExpenseAllocation
  // Catatan: `createManyAndReturn` tidak mendukung nested write, jadi Expense
  // dibuat dulu lalu alokasi ditulis terpisah.
  const nonReversal = data.expenses.filter((e) => e.reversalOfKey === undefined);
  const expenseIdByKey = new Map<string, string>();
  for (const rows of chunk(nonReversal, CHUNK)) {
    const created = await prisma.expense.createManyAndReturn({
      data: rows.map((e) => ({
        organizationId: ORG_ID,
        propertyId: e.propertyId,
        categoryId: e.categoryId,
        amount: e.amount,
        currency: e.currency,
        fxRateToBase: e.fxRateToBase,
        incurredOn: stayDateToDate(e.incurredOn),
        paidOn: stayDateToDate(e.paidOn),
        vendor: e.vendor,
        description: e.description,
        paymentMethod: e.paymentMethod,
        // Kunci idempotensi stabil untuk data dummy (Expense tidak punya kunci alami).
        receiptKey: e.key,
        status: e.status,
        createdById: DUMMY_ACTOR,
        verifiedById: e.status === "VERIFIED" ? DUMMY_ACTOR : null,
        verifiedAt: e.status === "VERIFIED" ? new Date() : null,
      })),
      select: { id: true, receiptKey: true },
    });
    for (const row of created) {
      if (row.receiptKey) expenseIdByKey.set(row.receiptKey, row.id);
    }
  }

  // Alokasi untuk expense non-pembalik.
  const allocationRows = data.expenses.flatMap((e) => {
    const expenseId = expenseIdByKey.get(e.key);
    if (!expenseId) return [];
    return e.allocations.map((a) => ({
      expenseId,
      propertyId: a.propertyId,
      amountBase: a.amountBase,
    }));
  });
  for (const rows of chunk(allocationRows, CHUNK)) {
    await prisma.expenseAllocation.createMany({ data: rows });
  }

  const reversals = data.expenses.filter((e) => e.reversalOfKey !== undefined);
  for (const e of reversals) {
    const reversalOfId = expenseIdByKey.get(e.reversalOfKey!);
    if (!reversalOfId) continue;
    await prisma.expense.create({
      data: {
        organizationId: ORG_ID,
        propertyId: e.propertyId,
        categoryId: e.categoryId,
        amount: e.amount,
        currency: e.currency,
        fxRateToBase: e.fxRateToBase,
        incurredOn: stayDateToDate(e.incurredOn),
        paidOn: stayDateToDate(e.paidOn),
        vendor: e.vendor,
        description: e.description,
        paymentMethod: e.paymentMethod,
        receiptKey: e.key,
        status: e.status,
        reversalOfId,
        createdById: DUMMY_ACTOR,
        verifiedById: DUMMY_ACTOR,
        verifiedAt: new Date(),
        allocations: { createMany: { data: [...e.allocations] } },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const seed = Number(process.env.DUMMY_SEED ?? DEFAULT_DUMMY_SEED);
  if (!Number.isInteger(seed))
    throw new Error(`DUMMY_SEED harus integer, got "${process.env.DUMMY_SEED}"`);

  const monthsBack = Number(process.env.DUMMY_MONTHS_BACK ?? 18);
  if (!Number.isInteger(monthsBack) || monthsBack < 1 || monthsBack > 36) {
    throw new Error(
      `DUMMY_MONTHS_BACK harus integer 1..36, got "${process.env.DUMMY_MONTHS_BACK}"`,
    );
  }

  const anchor = process.env.DUMMY_ANCHOR_DATE ?? todayInWITA();

  const refs = await loadRefs();
  console.log(
    `[seed-dummy] master: ${refs.units.length} unit sellable, ${refs.listings.length} listing aktif, ` +
      `${refs.categories.length} kategori, ${refs.propertyIds.length} properti`,
  );

  const removed = await wipeDummy();
  console.log(
    `[seed-dummy] dibersihkan: ${removed.bookings.count} booking, ${removed.bookingEvents.count} event, ` +
      `${removed.payouts.count} payout, ${removed.expenses.count} expense`,
  );

  const data = generateDummyDataset(refs, { anchor, seed, monthsBack });
  console.log(
    `[seed-dummy] jendela ${data.windowStart} s.d. ${data.windowEnd} (anchor ${anchor}, seed ${seed})`,
  );

  await write(data, seed);

  console.log(
    `[seed-dummy] selesai: ${data.bookings.length} booking, ${data.events.length} event, ` +
      `${data.payouts.length} payout, ${data.expenses.length} expense, ${data.importBatches.length} batch impor`,
  );
}

main()
  .catch((err) => {
    console.error("[seed-dummy] gagal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
