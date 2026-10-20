/**
 * Generator data dummy sintetis - S1-06.
 *
 * Modul ini PURE (tanpa I/O, tanpa Prisma) agar determinisme dan invarian
 * keuangan bisa diuji tanpa database. Penulisan ke DB dilakukan di
 * `prisma/seed-dummy.ts`.
 *
 * Sumber kebenaran: ROADMAP Fase 0 ("Generator data dummy: 2 properti, unit
 * sesuai bagian 2, 3 OTA, kasus tepi"), docs/05 §1 (pembulatan), §3 (alokasi
 * estate), §4 (status booking), docs/04 §5 (constraint integritas).
 *
 * Aturan yang dijaga modul ini:
 * - Deterministik penuh: seed + tanggal jangkar sama -> output identik.
 * - Tidak ada bentrok jadwal: tiap resource dijadwalkan berurutan (tanpa overlap).
 * - Sum BookingUnit.allocatedGross selalu sama dengan Booking.grossAmount dan
 *   Sum allocationPct selalu 1.0000 (invariant docs/04 §5).
 * - Uang selalu Decimal (disimpan sebagai string), tidak pernah float.
 * - Tanggal menginap bertipe StayDate "YYYY-MM-DD", waktu kejadian Timestamptz.
 *
 * KASUS TEP YANG DICAKUP (ROADMAP baris "kasus tepi"):
 * 1. Modifikasi booking      -> status CONFIRMED + event MODIFIED
 * 2. Pembatalan              -> status CANCELLED + event CANCELLED
 * 3. No-show                 -> status NO_SHOW + event NO_SHOW
 * 4. Booking seluruh estate  -> 1 alokasi mencakup semua unit properti estate
 * 5. Hanya 2 kamar disewakan -> properti nonin estate, tiap booking 1 unit
 * 6. Mata uang berbeda       -> USD + kurs eksplisit ke base IDR
 *
 * YANG SENGAJA TIDAK DIISI (agar keputusan terbuka tidak terkunci):
 * - OtherIncome: ROADMAP §4 "ada tidaknya pemasukan non-OTA" belum diputuskan.
 * - taxesCollected: kebijakan pajak belum ditetapkan, selalu 0.
 * - commissionRate: asumsi dummy berlabel, BUKAN rate kontrak OTA sebenarnya
 *   (OD-10/OD-11 masih terbuka; lihat docs/DECISIONS.md).
 */

import { addDays, monthOf, startOfMonth, type StayDate } from "../lib/dates";
import { Decimal } from "../lib/decimal";
import { allocateBookingToUnits, currencyPlaces } from "../domain/allocation";
import { mul, money, round, type Currency } from "../lib/money";

// ---------------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------------

/** Penanda data sintetis; muncul di externalId, vendor, dan description. */
export const DUMMY_MARKER = "DUMMY";
export const DUMMY_EXTERNAL_PREFIX = "DUMMY-";
/** Aktor placeholder untuk Expense.createdById (User asli dibuat di S1-03). */
export const DUMMY_ACTOR = "seed:dummy-generator";
export const DEFAULT_DUMMY_SEED = 20260101;

// ---------------------------------------------------------------------------
// Tipe
// ---------------------------------------------------------------------------

export type DummyChannel = "AIRBNB" | "TIKET_COM" | "TRAVELOKA";
export type DummyBookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW";
export type DummyCollectType = "CHANNEL_COLLECT" | "HOTEL_COLLECT";
export type DummyEventType =
  "CREATED" | "MODIFIED" | "CANCELLED" | "NO_SHOW" | "PAYOUT_LINKED" | "MANUAL_EDIT";
export type DummyCommissionBasis = "ESTIMATED" | "ACTUAL";
export type DummyAllocationMethod = "FIXED_PERCENT" | "ROOM_NIGHTS";

export interface DummyUnitRef {
  unitId: string;
  propertyId: string;
  name: string;
  /** Tarif dasar per malam dalam IDR (Decimal string). */
  baseRate: string;
  maxGuests: number;
}

export interface DummyListingRef {
  listingId: string;
  propertyId: string;
  channel: DummyChannel;
  currency: Currency;
  /**
   * Unit anggota listing sesuai tautan `ListingUnit` di database.
   * Satu booking pada listing ini dialokasikan ke SEMUA unit di sini (docs/05 §3).
   */
  unitIds: readonly string[];
  /** Asumsi rate komisi dummy (Decimal string), mis. "0.1400". */
  commissionRate: string;
}

export interface DummyCategoryRef {
  id: string;
  code: string;
}

export interface DummyGeneratorRefs {
  units: readonly DummyUnitRef[];
  listings: readonly DummyListingRef[];
  categories: readonly DummyCategoryRef[];
  /** Properti yang ikut menerima alokasi biaya; urutan = urutan tetap. */
  propertyIds: readonly string[];
}

export interface DummyGeneratorOptions {
  /** Tanggal jangkar (WITA). Seed + anchor sama -> output identik. */
  anchor: StayDate;
  seed?: number;
  /** Bulan ke belakang dari bulan jangkar. Default 18. */
  monthsBack?: number;
  /** Hari ke depan dari jangkar agar ada booking mendatang. Default 60. */
  futureDays?: number;
}

export interface DummyBookingUnitPlan {
  unitId: string;
  allocatedGross: string;
  allocationPct: string;
}

export interface DummyBookingPlan {
  externalId: string;
  listingId: string;
  propertyId: string;
  channel: DummyChannel;
  status: DummyBookingStatus;
  bookedAt: string;
  checkIn: StayDate;
  checkOut: StayDate;
  nights: number;
  guestsCount: number;
  currency: Currency;
  grossAmount: string;
  taxesCollected: string;
  cancellationFee: string;
  commissionAmount: string;
  commissionRate: string;
  commissionBasis: DummyCommissionBasis;
  collectType: DummyCollectType;
  fxRateToBase: string;
  fxRateSource: string;
  importBatchKey: string;
  units: readonly DummyBookingUnitPlan[];
}

export interface DummyEventPlan {
  bookingExternalId: string;
  type: DummyEventType;
  occurredAt: string;
  diff: Record<string, unknown> | null;
}

export interface DummyImportBatchPlan {
  key: string;
  channel: DummyChannel;
  kind: "EMAIL";
  filename: string;
  receivedAt: string;
}

export interface DummyImportItemPlan {
  batchKey: string;
  contentHash: string;
  status: "PARSED";
  bookingExternalId: string;
}

export interface DummyPayoutPlan {
  reference: string;
  channel: DummyChannel;
  payoutDate: StayDate;
  currency: Currency;
  amount: string;
  items: ReadonlyArray<{ bookingExternalId: string; amount: string }>;
}

export interface DummyExpenseAllocationPlan {
  propertyId: string;
  amountBase: string;
}

export interface DummyExpensePlan {
  key: string;
  propertyId: string | null;
  categoryId: string;
  categoryCode: string;
  amount: string;
  currency: Currency;
  fxRateToBase: string;
  incurredOn: StayDate;
  paidOn: StayDate;
  vendor: string;
  description: string;
  paymentMethod: string;
  status: "DRAFT" | "VERIFIED";
  allocations: readonly DummyExpenseAllocationPlan[];
  /** Kunci expense asli bila entri ini koreksi (docs/04 §5, AGENTS.md aturan 5). */
  reversalOfKey?: string;
}

export interface DummyDataset {
  anchor: StayDate;
  windowStart: StayDate;
  windowEnd: StayDate;
  bookings: readonly DummyBookingPlan[];
  events: readonly DummyEventPlan[];
  importBatches: readonly DummyImportBatchPlan[];
  importItems: readonly DummyImportItemPlan[];
  payouts: readonly DummyPayoutPlan[];
  expenses: readonly DummyExpensePlan[];
}

// ---------------------------------------------------------------------------
// PRNG deterministik
// ---------------------------------------------------------------------------

/**
 * PRNG mulberry32: kecil, cepat, deterministik lintas platform.
 * Hanya untuk data dummy - tidak dipakai di jalur parsing produksi
 * (AGENTS.md aturan 3: parser produksi wajib deterministik).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick: empty list");
  return item;
}

function addMonths(value: StayDate, n: number): StayDate {
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Tanggal UTC midnight dari StayDate (cocok dengan kolom @db.Date). */
export function stayDateToDate(value: StayDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Musim & kurs
// ---------------------------------------------------------------------------

/**
 * Faktor musiman okupansi Bali. Lebih besar dari 1 berarti musim tinggi ->
 * jeda antar-booking lebih pendek sehingga okupansi naik
 * (lihat docs/05 §2 untuk definisi okupansi).
 */
export function seasonalFactor(stay: StayDate): number {
  const month = Number(stay.slice(5, 7));
  if (month === 7 || month === 8) return 1.15; // Juli-Agustus: puncak musim tinggi
  if (month === 12 || month === 1) return 1.1; // Desember-Januari: musim ramai
  if (month === 3 || month === 11) return 0.8; // Maret & November: low season
  return 0.95;
}

/**
 * Kurs USD->IDR dummy yang bergeser pelan per bulan (sekitar 15.900-16.400).
 * Sumber ditandai agar tidak tertukar dengan kurs aktual.
 */
export function usdIdrRate(checkIn: StayDate): Decimal {
  const y = Number(checkIn.slice(0, 4));
  const m = Number(checkIn.slice(5, 7));
  const monthIndex = y * 12 + (m - 1);
  return new Decimal(15900).plus(new Decimal(monthIndex % 36).times(14)).toDecimalPlaces(2);
}

function fxRateFor(currency: Currency, checkIn: StayDate): Decimal {
  return currency === "USD" ? usdIdrRate(checkIn) : new Decimal(1);
}

function fxRateSourceFor(currency: Currency): string {
  return currency === "USD" ? `${DUMMY_MARKER}:usd-idr-monthly-drift` : "identity:IDR";
}

// ---------------------------------------------------------------------------
// Resource penjadwalan
// ---------------------------------------------------------------------------

interface Resource {
  propertyId: string;
  /** Semua unit yang dijual bersama saat satu resource terjual. */
  units: readonly DummyUnitRef[];
  listings: readonly DummyListingRef[];
  /** Rata-rata malam kosong antar-booking (dibagi faktor musim). */
  avgGapDays: number;
  minNights: number;
  maxNights: number;
}

function buildResources(refs: DummyGeneratorRefs): Resource[] {
  const unitById = new Map(refs.units.map((u) => [u.unitId, u]));
  const unitsByProperty = new Map<string, DummyUnitRef[]>();
  for (const u of refs.units) {
    const arr = unitsByProperty.get(u.propertyId) ?? [];
    arr.push(u);
    unitsByProperty.set(u.propertyId, arr);
  }
  const listingsByProperty = new Map<string, DummyListingRef[]>();
  for (const l of refs.listings) {
    const arr = listingsByProperty.get(l.propertyId) ?? [];
    arr.push(l);
    listingsByProperty.set(l.propertyId, arr);
  }

  const resources: Resource[] = [];
  for (const [propertyId, propUnits] of unitsByProperty) {
    const propListings = listingsByProperty.get(propertyId) ?? [];
    if (propUnits.length === 0 || propListings.length === 0) continue;

    // Kunci penentu estate vs per-unit adalah tautan ListingUnit, bukan jumlah
    // unit di properti. Kalau seluruh listing properti menautkan himpunan unit
    // yang sama dan lebih dari satu unit, itu listing gabungan (estate).
    const unitSets = new Map<string, string[]>();
    for (const listing of propListings) {
      const key = [...listing.unitIds].sort().join(",");
      if (!unitSets.has(key)) unitSets.set(key, [...listing.unitIds]);
    }
    const sets = [...unitSets.values()];
    const isCombinedListing = sets.length === 1 && (sets[0]?.length ?? 0) > 1;

    if (isCombinedListing) {
      const units = (sets[0] ?? [])
        .map((id) => unitById.get(id))
        .filter((u): u is DummyUnitRef => u !== undefined);
      if (units.length === 0) continue;
      resources.push({
        propertyId,
        units,
        listings: propListings,
        avgGapDays: 1,
        minNights: units.length > 2 ? 3 : 2,
        maxNights: units.length > 2 ? 14 : 7,
      });
    } else {
      // Tiap unit dijadwalkan terpisah karena tiap listing hanya menautkan 1 unit.
      const sellable = new Set(propListings.flatMap((l) => l.unitIds));
      for (const u of propUnits) {
        if (!sellable.has(u.unitId)) continue;
        resources.push({
          propertyId,
          units: [u],
          listings: propListings.filter((l) => l.unitIds.includes(u.unitId)),
          avgGapDays: 1,
          minNights: 2,
          maxNights: 7,
        });
      }
    }
  }
  return resources;
}

// ---------------------------------------------------------------------------
// Generator utama
// ---------------------------------------------------------------------------

export function generateDummyDataset(
  refs: DummyGeneratorRefs,
  options: DummyGeneratorOptions,
): DummyDataset {
  const rng = mulberry32(options.seed ?? DEFAULT_DUMMY_SEED);
  const anchor = options.anchor;
  const monthsBack = options.monthsBack ?? 18;
  const futureDays = options.futureDays ?? 60;
  const windowStart = startOfMonth(addMonths(anchor, -monthsBack));
  const windowEnd = addDays(anchor, futureDays);

  const bookings: DummyBookingPlan[] = [];
  const events: DummyEventPlan[] = [];

  for (const resource of buildResources(refs)) {
    let cursor = windowStart;
    while (cursor < windowEnd) {
      const season = seasonalFactor(cursor);
      // Jeda kosong dengan mean = avgGapDays / season (musim tinggi -> lebih rapat).
      const gap = Math.max(0, Math.round(-Math.log(1 - rng()) * (resource.avgGapDays / season)));
      const checkIn = addDays(cursor, gap);
      if (checkIn >= windowEnd) break;

      const nights = intBetween(rng, resource.minNights, resource.maxNights);
      const checkOut = addDays(checkIn, nights);

      const listing = pick(rng, resource.listings);
      const currency = pickCurrency(rng, listing);
      const collectType = pickCollectType(rng, listing.channel);
      const isPast = checkOut <= anchor;
      const status = pickStatus(rng, isPast);
      const places = currencyPlaces(currency);

      const nightly = avgBaseRate(resource.units)
        .times(new Decimal(0.85).plus(new Decimal(rng()).times(0.3)))
        .toDecimalPlaces(0);
      const gross = round(mul(money(nightly, currency), nights), places);

      const commissionRate = new Decimal(listing.commissionRate);
      const commission = round(mul(money(gross.amount, currency), commissionRate), places);

      const cancellationFee =
        status === "CANCELLED" && rng() < 0.6
          ? round(mul(money(gross.amount, currency), new Decimal(0.5)), places)
          : round(money(0, currency), places);

      const externalId = `${DUMMY_EXTERNAL_PREFIX}${listing.channel}-${String(
        bookings.length + 1,
      ).padStart(5, "0")}`;

      // Alokasi resmi (docs/05 §3) -> jumlah allocatedGross selalu = grossAmount.
      const allocation = allocateBookingToUnits(
        money(gross.amount, currency),
        resource.units.map((u) => ({
          unitId: u.unitId,
          baseRate: u.baseRate,
          maxGuests: u.maxGuests,
        })),
      );

      const bookedAtDate = addDays(checkIn, -intBetween(rng, 5, 60));
      const bookedAt = stayDateToDate(bookedAtDate);
      bookedAt.setUTCHours(intBetween(rng, 1, 20), intBetween(rng, 0, 59), 0, 0);

      bookings.push({
        externalId,
        listingId: listing.listingId,
        propertyId: resource.propertyId,
        channel: listing.channel,
        status,
        bookedAt: bookedAt.toISOString(),
        checkIn,
        checkOut,
        nights,
        guestsCount: intBetween(rng, 1, maxGuestsOf(resource.units)),
        currency,
        grossAmount: gross.amount.toFixed(places),
        taxesCollected: new Decimal(0).toFixed(places),
        cancellationFee: cancellationFee.amount.toFixed(places),
        commissionAmount: commission.amount.toFixed(places),
        commissionRate: commissionRate.toFixed(4),
        commissionBasis: "ESTIMATED",
        collectType,
        fxRateToBase: fxRateFor(currency, checkIn).toFixed(8),
        fxRateSource: fxRateSourceFor(currency),
        importBatchKey: importBatchKeyFor(listing.channel, bookedAtDate),
        units: allocation.allocations.map((a) => ({
          unitId: a.unitId,
          allocatedGross: a.allocatedGross.amount.toFixed(places),
          allocationPct: a.allocationPct.toFixed(4),
        })),
      });

      events.push({
        bookingExternalId: externalId,
        type: "CREATED",
        occurredAt: bookedAt.toISOString(),
        diff: null,
      });

      // Kasus tepi: modifikasi, pembatalan, no-show.
      if (status === "CONFIRMED" && isPast && rng() < 0.15) {
        events.push({
          bookingExternalId: externalId,
          type: "MODIFIED",
          occurredAt: new Date(
            bookedAt.getTime() + intBetween(rng, 1, 5) * 86_400_000,
          ).toISOString(),
          diff: { field: pick(rng, ["checkOut", "guestsCount"]), source: "ota-email" },
        });
      }
      if (status === "CANCELLED") {
        events.push({
          bookingExternalId: externalId,
          type: "CANCELLED",
          occurredAt: new Date(
            bookedAt.getTime() + intBetween(rng, 1, 10) * 86_400_000,
          ).toISOString(),
          diff: { source: "ota-email" },
        });
      }
      if (status === "NO_SHOW") {
        const noShowAt = stayDateToDate(checkIn);
        noShowAt.setUTCHours(12, 0, 0, 0);
        events.push({
          bookingExternalId: externalId,
          type: "NO_SHOW",
          occurredAt: noShowAt.toISOString(),
          diff: { source: "ops" },
        });
      }

      // Maju ke malam checkout: menjamin tidak ada overlap pada resource ini.
      cursor = checkOut;
    }
  }

  const roomNights = countRoomNights(bookings);
  const importBatches = buildImportBatches(bookings);
  const importItems = bookings.map((b) => ({
    batchKey: b.importBatchKey,
    contentHash: contentHashFor(b.externalId),
    status: "PARSED" as const,
    bookingExternalId: b.externalId,
  }));

  const payouts = buildPayouts(bookings, anchor);
  applySettledCommission(bookings, payouts, events);

  return {
    anchor,
    windowStart,
    windowEnd,
    bookings,
    events,
    importBatches,
    importItems,
    payouts,
    expenses: buildExpenses(refs, anchor, monthsBack, roomNights),
  };
}

// ---------------------------------------------------------------------------
// Helper booking
// ---------------------------------------------------------------------------

function pickStatus(rng: () => number, isPast: boolean): DummyBookingStatus {
  if (!isPast) return rng() < 0.12 ? "PENDING" : "CONFIRMED";
  const roll = rng();
  if (roll < 0.08) return "CANCELLED";
  if (roll < 0.11) return "NO_SHOW";
  return "CONFIRMED";
}

function pickCurrency(rng: () => number, listing: DummyListingRef): Currency {
  if (listing.currency === "USD") return "USD";
  // Listing IDR tapi sesekali tamu memesan dalam USD (kasus tepi "mata uang beda").
  return rng() < 0.12 ? "USD" : "IDR";
}

function pickCollectType(rng: () => number, channel: DummyChannel): DummyCollectType {
  if (channel === "AIRBNB") return rng() < 0.6 ? "CHANNEL_COLLECT" : "HOTEL_COLLECT";
  return rng() < 0.85 ? "CHANNEL_COLLECT" : "HOTEL_COLLECT";
}

function avgBaseRate(units: readonly DummyUnitRef[]): Decimal {
  if (units.length === 0) return new Decimal(0);
  const sum = units.reduce((acc, u) => acc.plus(new Decimal(u.baseRate)), new Decimal(0));
  return sum.dividedBy(units.length);
}

function maxGuestsOf(units: readonly DummyUnitRef[]): number {
  return units.reduce((acc, u) => Math.max(acc, u.maxGuests), 1);
}

function contentHashFor(externalId: string): string {
  // FNV-1a 32-bit; cukup untuk label konten sintetis (bukan untuk keamanan).
  let h = 0x811c9dc5;
  for (let i = 0; i < externalId.length; i++) {
    h ^= externalId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function importBatchKeyFor(channel: DummyChannel, date: StayDate): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return `batch-${channel}-${y}Q${Math.floor((m - 1) / 3) + 1}`;
}

/** Malam terjual per "propertyId|YYYY-MM"; pembanding alokasi ROOM_NIGHTS. */
export function countRoomNights(bookings: readonly DummyBookingPlan[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of bookings) {
    if (b.status === "CANCELLED" || b.status === "NO_SHOW") continue;
    const key = `${b.propertyId}|${monthOf(b.checkIn)}`;
    out[key] = (out[key] ?? 0) + b.nights;
  }
  return out;
}

function buildImportBatches(bookings: readonly DummyBookingPlan[]): DummyImportBatchPlan[] {
  const seen = new Map<string, DummyImportBatchPlan>();
  for (const b of bookings) {
    if (seen.has(b.importBatchKey)) continue;
    seen.set(b.importBatchKey, {
      key: b.importBatchKey,
      channel: b.channel,
      kind: "EMAIL",
      filename: `dummy/${b.channel.toLowerCase()}/${b.importBatchKey}.eml`,
      receivedAt: b.bookedAt,
    });
  }
  return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Payout per (channel, currency, bulan) dari booking CHANNEL_COLLECT yang lewat. */
function buildPayouts(bookings: readonly DummyBookingPlan[], anchor: StayDate): DummyPayoutPlan[] {
  const settleCutoff = addDays(anchor, -45);
  const groups = new Map<
    string,
    {
      channel: DummyChannel;
      currency: Currency;
      payoutDate: StayDate;
      items: { bookingExternalId: string; amount: string }[];
    }
  >();

  for (const b of bookings) {
    if (b.collectType !== "CHANNEL_COLLECT" || b.status !== "CONFIRMED") continue;
    if (b.checkOut > settleCutoff) continue;
    const payoutDate = addDays(b.checkOut, 30);
    const key = `${b.channel}|${b.currency}|${monthOf(payoutDate)}`;
    const group = groups.get(key) ?? {
      channel: b.channel,
      currency: b.currency,
      payoutDate: `${monthOf(payoutDate)}-05`,
      items: [],
    };
    const net = new Decimal(b.grossAmount).minus(new Decimal(b.commissionAmount));
    group.items.push({
      bookingExternalId: b.externalId,
      amount: net.toFixed(currencyPlaces(b.currency)),
    });
    groups.set(key, group);
  }

  const payouts: DummyPayoutPlan[] = [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const places = currencyPlaces(group.currency);
    const amount = group.items.reduce(
      (acc, it) => acc.plus(new Decimal(it.amount)),
      new Decimal(0),
    );
    payouts.push({
      reference: `${DUMMY_EXTERNAL_PREFIX}PO-${key.replace(/[^A-Za-z0-9]+/g, "-")}`,
      channel: group.channel,
      payoutDate: group.payoutDate,
      currency: group.currency,
      amount: amount.toFixed(places),
      items: group.items,
    });
  }
  return payouts;
}

/** Booking yang sudah dibayarkan -> commissionBasis ACTUAL (estimasi vs aktual). */
function applySettledCommission(
  bookings: DummyBookingPlan[],
  payouts: readonly DummyPayoutPlan[],
  events: DummyEventPlan[],
): void {
  const payoutByRef = new Map(payouts.map((p) => [p.reference, p]));
  for (const b of bookings) {
    const settled = payouts.find((p) =>
      p.items.some((it) => it.bookingExternalId === b.externalId),
    );
    if (!settled) continue;
    b.commissionBasis = "ACTUAL";
    events.push({
      bookingExternalId: b.externalId,
      type: "PAYOUT_LINKED",
      occurredAt: `${payoutByRef.get(settled.reference)?.payoutDate ?? settled.payoutDate}T00:00:00.000Z`,
      diff: { payoutReference: settled.reference },
    });
  }
}

// ---------------------------------------------------------------------------
// Pengeluaran
// ---------------------------------------------------------------------------

interface ExpenseSpec {
  method: DummyAllocationMethod;
  minAmount: number;
  maxAmount: number;
  vendor: string;
  paymentMethod: string;
  /** Bobot tetap antar properti; hanya untuk FIXED_PERCENT. */
  fixedShares?: readonly number[];
  /** Tempel ke satu properti (tanpa alokasi lintas properti). */
  fixedPropertyIndex?: number;
  /** Biaya naik-turun mengikuti okupansi. */
  occupancyLinked?: boolean;
}

export const EXPENSE_SPECS: Readonly<Record<string, ExpenseSpec>> = {
  SALARY: {
    method: "FIXED_PERCENT",
    minAmount: 20_000_000,
    maxAmount: 26_000_000,
    vendor: "Tim Hillside Eden",
    paymentMethod: "TRANSFER",
    fixedShares: [0.6, 0.4],
  },
  UTILITIES: {
    method: "ROOM_NIGHTS",
    minAmount: 3_500_000,
    maxAmount: 6_000_000,
    vendor: "PLN & PDAM",
    paymentMethod: "AUTO_DEBIT",
    occupancyLinked: true,
  },
  INTERNET: {
    method: "FIXED_PERCENT",
    minAmount: 1_200_000,
    maxAmount: 1_600_000,
    vendor: "Indihome",
    paymentMethod: "AUTO_DEBIT",
    fixedShares: [0.6, 0.4],
  },
  HOUSEKEEPING: {
    method: "ROOM_NIGHTS",
    minAmount: 2_000_000,
    maxAmount: 5_000_000,
    vendor: "Linen & Housekeeping",
    paymentMethod: "TRANSFER",
    occupancyLinked: true,
  },
  MAINTENANCE: {
    method: "ROOM_NIGHTS",
    minAmount: 800_000,
    maxAmount: 6_000_000,
    vendor: "Bengkel & Tukang",
    paymentMethod: "CASH",
    occupancyLinked: true,
  },
  MARKETING: {
    method: "FIXED_PERCENT",
    minAmount: 1_500_000,
    maxAmount: 4_000_000,
    vendor: "Meta & Google Ads",
    paymentMethod: "CARD",
    fixedShares: [0.7, 0.3],
  },
  TAX_LICENSE_INSURANCE: {
    method: "FIXED_PERCENT",
    minAmount: 2_000_000,
    maxAmount: 8_000_000,
    vendor: "Kantor Pajak & Asuransi",
    paymentMethod: "TRANSFER",
    fixedShares: [0.5, 0.5],
  },
  TRANSPORT: {
    method: "ROOM_NIGHTS",
    minAmount: 600_000,
    maxAmount: 2_000_000,
    vendor: "Gojek & Transport",
    paymentMethod: "CASH",
    occupancyLinked: true,
  },
  RENT_LEASE: {
    method: "FIXED_PERCENT",
    minAmount: 12_000_000,
    maxAmount: 12_000_000,
    vendor: "Sewa Lahan",
    paymentMethod: "TRANSFER",
    fixedPropertyIndex: 0,
    fixedShares: [1],
  },
  MISC: {
    method: "ROOM_NIGHTS",
    minAmount: 300_000,
    maxAmount: 1_500_000,
    vendor: "Various Vendors",
    paymentMethod: "CASH",
    occupancyLinked: true,
  },
};

function buildExpenses(
  refs: DummyGeneratorRefs,
  anchor: StayDate,
  monthsBack: number,
  roomNights: Record<string, number>,
): DummyExpensePlan[] {
  // Seed terpisah dari booking agar biaya tidak bergeser saat parameter lain berubah.
  const rng = mulberry32(DEFAULT_DUMMY_SEED ^ 0x5f3759df);
  const plans: DummyExpensePlan[] = [];
  const catByCode = new Map(refs.categories.map((c) => [c.code, c]));
  const propIds = [...refs.propertyIds];
  if (propIds.length === 0) return plans;

  const firstMonth = startOfMonth(addMonths(anchor, -monthsBack));
  const lastMonth = monthOf(anchor);
  const currentMonth = monthOf(anchor);

  for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
    const ym = monthOf(month);
    const occupancyFactor = new Decimal(
      Math.max(0.3, Math.min(1.4, nightsForMonth(roomNights, ym) / 30)),
    );

    for (const [code, spec] of Object.entries(EXPENSE_SPECS)) {
      const category = catByCode.get(code);
      if (!category) continue;

      const raw = new Decimal(intBetween(rng, spec.minAmount, spec.maxAmount));
      const amount = (spec.occupancyLinked ? raw.times(occupancyFactor) : raw).toDecimalPlaces(
        0,
        Decimal.ROUND_HALF_UP,
      );

      const incurredOn = `${ym}-${String(
        Math.min(intBetween(rng, 3, 12), daysInMonth(month)),
      ).padStart(2, "0")}`;
      const { propertyId, allocations } = allocateExpense(amount, spec, propIds, roomNights, ym);

      plans.push({
        key: `exp-${ym}-${code}`,
        propertyId,
        categoryId: category.id,
        categoryCode: code,
        amount: amount.toFixed(2),
        currency: "IDR",
        fxRateToBase: "1",
        incurredOn,
        paidOn: addDays(incurredOn, intBetween(rng, 0, 3)),
        vendor: `[${DUMMY_MARKER}] ${spec.vendor}`,
        description: `[${DUMMY_MARKER}] ${code} ${ym}`,
        paymentMethod: spec.paymentMethod,
        status: ym >= currentMonth ? "DRAFT" : "VERIFIED",
        allocations,
      });
    }
  }

  // Contoh koreksi lewat entri pembalik (AGENTS.md aturan 5, docs/04 §5).
  const original = plans.find((p) => p.categoryCode === "MISC");
  if (original) {
    plans.push({
      ...original,
      key: `${original.key}-reversal`,
      amount: new Decimal(original.amount).negated().toFixed(2),
      vendor: `[${DUMMY_MARKER}] Reversal: ${original.vendor}`,
      description: `[${DUMMY_MARKER}] Koreksi pembalik untuk ${original.description}`,
      status: "VERIFIED",
      reversalOfKey: original.key,
      allocations: original.allocations.map((a) => ({
        propertyId: a.propertyId,
        amountBase: new Decimal(a.amountBase).negated().toFixed(2),
      })),
    });
  }

  return plans;
}

function allocateExpense(
  amount: Decimal,
  spec: ExpenseSpec,
  propIds: readonly string[],
  roomNights: Record<string, number>,
  ym: string,
): { propertyId: string | null; allocations: readonly DummyExpenseAllocationPlan[] } {
  // Biaya menempel ke satu properti saja (mis. sewa lahan estate).
  const pinned = spec.fixedPropertyIndex;
  if (pinned !== undefined && propIds[pinned] !== undefined) {
    const propertyId = propIds[pinned]!;
    return { propertyId, allocations: [{ propertyId, amountBase: amount.toFixed(2) }] };
  }

  const weights: number[] =
    spec.method === "FIXED_PERCENT" && spec.fixedShares
      ? spec.fixedShares.slice(0, propIds.length)
      : propIds.map((pid) => roomNights[`${pid}|${ym}`] ?? 0);

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return {
      propertyId: null,
      allocations: [{ propertyId: propIds[0]!, amountBase: amount.toFixed(2) }],
    };
  }

  const allocations: DummyExpenseAllocationPlan[] = [];
  let remaining = amount;
  for (let i = 0; i < propIds.length - 1; i++) {
    const share = amount
      .times(weights[i] ?? 0)
      .dividedBy(total)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    allocations.push({ propertyId: propIds[i]!, amountBase: share.toFixed(2) });
    remaining = remaining.minus(share);
  }
  // Sisa pembulatan ke properti terakhir (docs/05 §1).
  allocations.push({
    propertyId: propIds[propIds.length - 1]!,
    amountBase: remaining.toFixed(2),
  });
  return { propertyId: null, allocations };
}

function nightsForMonth(roomNights: Record<string, number>, ym: string): number {
  let total = 0;
  for (const [key, nights] of Object.entries(roomNights)) {
    if (key.endsWith(`|${ym}`)) total += nights;
  }
  return total;
}

function daysInMonth(monthStart: StayDate): number {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
