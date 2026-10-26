/**
 * pipeline/upsert.ts (S2-02.5).
 *
 * Tujuan: menerapkan satu ParsedBookingEvent ke DB secara transaksional
 * dengan strategi event-sourced (idempoten, out-of-order aman).
 *
 * Sumber kebenaran:
 * - docs/03 §3.1 (pipeline orchestrator -> upsert)
 * - docs/03 §3.2 (event-sourced; latest occurredAt menang; financial
 *   fields TIDAK pernah di-edit/hapus pada data terverifikasi -> hanya
 *   lewat event CANCELLED baru / pembalik)
 * - docs/04 schema (Booking unik per (organizationId, channel, externalId),
 *   BookingEvent unik per (bookingId, type, occurredAt))
 * - ADR-008: setiap mutasi keuangan wajib menulis AuditLog.
 *
 * Prinsip:
 * - Idempoten via 2 lapis:
 *   1. ImportItem.contentHash -> DUPLICATE di lapisan pipeline
 *   2. BookingEvent @@unique([bookingId,type,occurredAt]) dilampaui -> skip
 * - Out-of-order: BookingEvent SELALU ditulis; kolom Booking hanya diperbarui
 *   jika event.occurredAt >= max(occurredAt) event sebelumnya.
 * - CANCELLED: hapus BookingUnit (alokasi unit dilepas agar kalender kembali
 *   sellable); financial fields (grossAmount, cancellationFee) tetap.
 * - Distribusi allocation lewat allocateBookingToUnits (sudah property-tested).
 */
import type { Prisma, PrismaClient } from "@prisma/client";

import { Decimal } from "@/lib/decimal";
import { daysBetween } from "@/lib/dates";
import { money, round } from "@/lib/money";
import type { Currency } from "@/lib/money";
import { allocateBookingToUnits, type AllocatableUnit } from "@/domain/allocation";
import type { BookingStatus, CollectType, EventType, NormalizedBooking } from "@/adapters/types";
import type { BookingDiff } from "./diff";

/** Hasil apply event ke DB. */
export type UpsertOutcome =
  | { kind: "created"; bookingId: string; eventId: string }
  | { kind: "updated"; bookingId: string; eventId: string }
  | { kind: "duplicate"; bookingId: string };

/** Subset Prisma yang dipakai upsert (real client & tx memenuhi ini). */
export interface UpsertTx {
  bookingEvent: Prisma.BookingEventDelegate;
  booking: Prisma.BookingDelegate;
  bookingUnit: Prisma.BookingUnitDelegate;
  listingUnit: Prisma.ListingUnitDelegate;
  unit: Prisma.UnitDelegate;
}

/** Input apply. */
export interface ApplyBookingEventInput {
  organizationId: string;
  /** id Listing hasil resolveListing. */
  listingId: string;
  /** id Property terkait listing. */
  propertyId: string;
  /** NormalizedBooking dari parser adapter. */
  booking: NormalizedBooking;
  eventType: EventType;
  occurredAt: Date;
  /** diff JSON pre-computed (opsional; akan dihitung saat tidak ada). */
  diff?: BookingDiff | null;
  /** id ImportItem untuk jejak balik ke batch. */
  importItemId?: string;
  /** id User pemicu (untuk audit context). */
  actorId?: string | null;
  /** Source adapter id penghasil event (untuk audit). */
  sourceAdapterId?: string;
}

const CURRENCY_PLACES: Record<Currency, number> = { IDR: 0, USD: 2 };

/**
 * Field turunan default untuk membuat Booking baru.
 */
export interface BookingFields {
  nights: number;
  guestsCount: number;
  currency: Currency;
  grossAmount: Decimal;
  taxesCollected: Decimal;
  cancellationFee: Decimal;
  commissionAmount: Decimal | null;
  commissionRate: Decimal | null;
  collectType: CollectType;
  fxRateToBase: Decimal;
  fxRateSource: string | null;
  bookedAt: Date | null;
}

/** Murni: konversi NormalizedBooking ke nilai kolom DB. */
export function inferBookingFields(b: NormalizedBooking): BookingFields {
  const nights = b.nights ?? Math.max(daysBetween(b.checkIn, b.checkOut), 0);
  const guestsCount = b.guestsCount ?? 1;
  const currency = (b.currency ?? "IDR").toUpperCase() as Currency;
  const grossAmount = b.grossAmount !== undefined ? new Decimal(b.grossAmount) : new Decimal(0);
  const taxesCollected =
    b.taxesCollected !== undefined ? new Decimal(b.taxesCollected) : new Decimal(0);
  const cancellationFee =
    b.cancellationFee !== undefined ? new Decimal(b.cancellationFee) : new Decimal(0);
  const commissionAmount =
    b.commissionAmount !== undefined ? new Decimal(b.commissionAmount) : null;
  const commissionRate = b.commissionRate !== undefined ? new Decimal(b.commissionRate) : null;

  // Konversi kurs ke base currency (IDR) per docs/05 §1 & OD-05
  const isUsd = currency === "USD";
  const fxRateToBase = isUsd ? new Decimal(16000) : new Decimal(1);
  const fxRateSource = isUsd ? "ESTIMATED_DEFAULT" : null;

  return {
    nights,
    guestsCount,
    currency,
    grossAmount,
    taxesCollected,
    cancellationFee,
    commissionAmount,
    commissionRate,
    collectType: b.collectType ?? "UNKNOWN",
    fxRateToBase,
    fxRateSource,
    bookedAt: b.bookedAt ?? null,
  };
}

/** Tier dan baris alokasi unit hasil keputusan murni. */
export type AllocationTier =
  "EXPLICIT_WEIGHT" | "BASE_RATE" | "MAX_GUESTS" | "EQUAL_SPLIT" | "NONE";

export interface AllocationDecision {
  /** true bila baris-baris perlu di-upsert (status bukan CANCELLED & unit tersedia). */
  allocate: boolean;
  tier: AllocationTier;
  rows: Array<{ unitId: string; allocatedGross: Decimal; allocationPct: Decimal }>;
}

/**
 * Murni: memutuskan alokasi unit. CANCELLED -> tidak alokasi
 * (biar BookingUnit dihapus di caller). Tanpa unit -> tidak ada baris.
 * Bila ada unit, distribusi lewat allocateBookingToUnits (idempoten).
 */
export function computeAllocation(args: {
  status: BookingStatus;
  gross: Decimal;
  currency: Currency;
  units: ReadonlyArray<AllocatableUnit>;
}): AllocationDecision {
  if (args.status === "CANCELLED") {
    return { allocate: false, tier: "NONE", rows: [] };
  }
  if (args.units.length === 0) {
    return { allocate: false, tier: "NONE", rows: [] };
  }
  const grossMoney = round(money(args.gross, args.currency), CURRENCY_PLACES[args.currency]);
  const result = allocateBookingToUnits(grossMoney, args.units);
  return {
    allocate: true,
    tier: result.tierUsed,
    rows: result.allocations.map((a) => ({
      unitId: a.unitId,
      allocatedGross: a.allocatedGross.amount,
      allocationPct: a.allocationPct,
    })),
  };
}

/** Muat unit-unit anggota listing (untuk alokasi). Murni di sisi DB. */
export async function loadListingUnits(
  tx: UpsertTx,
  listingId: string,
): Promise<AllocatableUnit[]> {
  const lus = await tx.listingUnit.findMany({
    where: { listingId },
    include: { unit: true },
  });
  return lus.map((lu) => ({
    unitId: lu.unitId,
    allocationWeight:
      lu.allocationWeight === null || lu.allocationWeight === undefined
        ? null
        : new Decimal(lu.allocationWeight.toString()),
    // baseRate dipakai allocateBookingToUnits sebagai bobot (bukan nilai moneter).
    baseRate:
      lu.unit.baseRate === null || lu.unit.baseRate === undefined
        ? null
        : new Decimal(lu.unit.baseRate.toString()),
    maxGuests: lu.unit.maxGuests ?? null,
  }));
}

/** Subset kolom Booking yang dipakai untuk diff dan snapshot. */
interface BookingRow {
  id: string;
  organizationId: string;
  propertyId: string;
  listingId: string;
  channel: import("@prisma/client").ChannelCode;
  externalId: string;
  status: import("@prisma/client").BookingStatus;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestsCount: number | null;
  currency: string;
  grossAmount: Decimal;
  taxesCollected: Decimal;
  cancellationFee: Decimal;
  commissionAmount: Decimal | null;
  commissionRate: Decimal | null;
  collectType: import("@prisma/client").CollectType;
  fxRateToBase: Decimal;
  bookedAt: Date | null;
  bookedAtIsApprox: boolean;
  importBatchId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** Representasi Booking sebagai snapshot untuk diffBooking(). */
function toBookingSnapshot(row: BookingRow) {
  return {
    status: row.status as BookingStatus,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: row.nights,
    guestsCount: row.guestsCount,
    currency: row.currency,
    grossAmount: row.grossAmount,
    taxesCollected: row.taxesCollected,
    cancellationFee: row.cancellationFee,
    commissionAmount: row.commissionAmount,
    commissionRate: row.commissionRate,
    collectType: row.collectType,
    fxRateToBase: row.fxRateToBase,
  };
}

/**
 * Terapkan satu ParsedBookingEvent ke DB secara atomic.
 *
 * Algoritma:
 * 1. Cari Booking by (org, channel, externalId). Bila tidak ada -> buat.
 * 2. Bandingkan snapshot lama vs event baru (diffBooking) -> simpan ke
 *    BookingEvent.diff JSON.
 * 3. Tulis BookingEvent (idempoten: lewati bila duplicate unique constraint).
 * 4. Update kolom Booking hanya bila event.occurredAt >= max(occurredAt)
 *    event sebelumnya (atau baru; out-of-order aman).
 * 5. Kelola BookingUnit:
 *    - status non-CANCELLED: upsert baris alokasi dari computeAllocation()
 *    - status CANCELLED: hapus baris alokasi (lepas unit)
 *
 * Return: outcome (created | updated | duplicate) + ids.
 */
export async function applyBookingEvent(
  tx: UpsertTx,
  input: ApplyBookingEventInput,
): Promise<UpsertOutcome> {
  const { organizationId, listingId, propertyId, booking, eventType, occurredAt, importItemId } =
    input;

  // Pakai unique (org,channel,externalId) sesuai schema.
  const existing = (await tx.booking.findUnique({
    where: {
      organizationId_channel_externalId: {
        organizationId,
        channel: booking.channel,
        externalId: booking.externalId,
      },
    },
  })) as BookingRow | null;

  if (existing) {
    // Validasi konsistensi propertyId & listingId. Bila beda -> lemparkan hard error.
    if (existing.listingId !== listingId || existing.propertyId !== propertyId) {
      throw new Error(
        `Booking ${existing.id} konflik listing/property: existing=(${existing.listingId},${existing.propertyId}) vs event=(${listingId},${propertyId}). ` +
          `Periksa mapping profile / resolution.`,
      );
    }
  }

  const inferred = inferBookingFields(booking);

  if (!existing) {
    // Buat booking baru.
    const created = (await tx.booking.create({
      data: {
        organizationId,
        propertyId,
        listingId,
        channel: booking.channel,
        externalId: booking.externalId,
        status: booking.status,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: inferred.nights,
        guestsCount: inferred.guestsCount,
        currency: inferred.currency,
        grossAmount: inferred.grossAmount,
        taxesCollected: inferred.taxesCollected,
        cancellationFee: inferred.cancellationFee,
        commissionAmount: inferred.commissionAmount,
        commissionRate: inferred.commissionRate,
        collectType: inferred.collectType,
        fxRateToBase: inferred.fxRateToBase,
        fxRateSource: inferred.fxRateSource,
        bookedAt: inferred.bookedAt,
        bookedAtIsApprox: inferred.bookedAt === null,
      },
    })) as BookingRow;

    // Tulis event (booking baru: belum ada diff karena tidak ada state sebelumnya).
    const event = await writeBookingEvent(tx, {
      bookingId: created.id,
      type: eventType,
      occurredAt,
      importItemId,
    }).catch((err: unknown) => {
      if (isUniqueConstraintError(err)) return null;
      throw err;
    });

    // Hitung alokasi unit (skip pada CANCELLED / tanpa unit).
    const units = await loadListingUnits(tx, listingId);
    const decision = computeAllocation({
      status: booking.status,
      gross: inferred.grossAmount,
      currency: inferred.currency,
      units,
    });
    if (decision.allocate && decision.rows.length > 0) {
      await replaceBookingUnits(tx, created.id, decision.rows);
    }

    return { kind: "created", bookingId: created.id, eventId: event?.id ?? "rolled-back" };
  }

  // Booking sudah ada: alur update.
  const snapshot = toBookingSnapshot(existing);
  const { diffBooking } = await import("./diff");
  const diff = (input.diff ? input.diff : diffBooking(snapshot, booking)) as BookingDiff;

  // Out-of-order guard: ambil max(occurredAt) event sebelumnya.
  const prevMax = await tx.bookingEvent
    .findFirst({
      where: { bookingId: existing.id },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    })
    .then((r) => r?.occurredAt ?? null);

  const isLater = prevMax === null || occurredAt.getTime() >= prevMax.getTime();

  // Tulis event SELALU (immutable log). Skip bila duplicate.
  const event = await writeBookingEvent(tx, {
    bookingId: existing.id,
    type: eventType,
    occurredAt,
    diff: serializeDiff(diff),
    importItemId,
  }).catch((err: unknown) => {
    if (isUniqueConstraintError(err)) return null;
    throw err;
  });
  if (event === null) {
    // Duplicate event: tidak update booking.
    return { kind: "duplicate", bookingId: existing.id };
  }

  if (isLater) {
    // Update kolom Booking dengan nilai event (last-writer-wins).
    await tx.booking.update({
      where: { id: existing.id },
      data: {
        status: booking.status,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: inferred.nights,
        guestsCount: inferred.guestsCount,
        currency: inferred.currency,
        grossAmount: inferred.grossAmount,
        taxesCollected: inferred.taxesCollected,
        cancellationFee: inferred.cancellationFee,
        commissionAmount: inferred.commissionAmount,
        commissionRate: inferred.commissionRate,
        collectType: inferred.collectType,
        lastSeenAt: new Date(),
      },
    });
  } else {
    // Out-of-order: tetap update lastSeenAt agar jejak tetap hidup.
    await tx.booking.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
  }

  // Kelola BookingUnit:
  if (booking.status === "CANCELLED") {
    await tx.bookingUnit.deleteMany({ where: { bookingId: existing.id } });
  } else {
    const units = await loadListingUnits(tx, listingId);
    const decision = computeAllocation({
      status: booking.status,
      gross: inferred.grossAmount,
      currency: inferred.currency,
      units,
    });
    if (decision.allocate && decision.rows.length > 0) {
      await replaceBookingUnits(tx, existing.id, decision.rows);
    } else {
      // Tidak ada unit anggota: hapus baris existing (kalau ada).
      await tx.bookingUnit.deleteMany({ where: { bookingId: existing.id } });
    }
  }

  return { kind: "updated", bookingId: existing.id, eventId: event.id };
}

/** Tulis satu BookingEvent (immutable). */
async function writeBookingEvent(
  tx: UpsertTx,
  args: {
    bookingId: string;
    type: EventType;
    occurredAt: Date;
    diff?: Prisma.InputJsonValue;
    importItemId?: string;
  },
): Promise<{ id: string }> {
  const row = await tx.bookingEvent.create({
    data: {
      bookingId: args.bookingId,
      type: args.type,
      occurredAt: args.occurredAt,
      ...(args.diff ? { diff: args.diff } : {}),
      ...(args.importItemId ? { importItemId: args.importItemId } : {}),
    },
    select: { id: true },
  });
  return { id: row.id };
}

/** Serialize diff JSON untuk kolom Json?. Menghilangkan field undefined. */
export function serializeDiff(
  diff: BookingDiff | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (!diff) return undefined;
  return JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue;
}

/** Upsert baris BookingUnit dari hasil computeAllocation (idempoten). */
async function replaceBookingUnits(
  tx: UpsertTx,
  bookingId: string,
  rows: Array<{ unitId: string; allocatedGross: Decimal; allocationPct: Decimal }>,
): Promise<void> {
  // Hapus dulu agar fairness dengan bobot baru (mis. perubahan ListingUnit).
  await tx.bookingUnit.deleteMany({ where: { bookingId } });
  if (rows.length === 0) return;
  await tx.bookingUnit.createMany({
    data: rows.map((r) => ({
      bookingId,
      unitId: r.unitId,
      allocatedGross: r.allocatedGross,
      allocationPct: r.allocationPct,
    })),
  });
}

/** Deteksi error P2002 (unique constraint) dari Prisma. */
function isUniqueConstraintError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as { code?: string; meta?: { target?: unknown } };
  return e.code === "P2002";
}

/** Factory: membuka transaksi Prisma untuk dipakai apply. */
export async function runApplyInTransaction(
  prisma: PrismaClient,
  input: ApplyBookingEventInput,
): Promise<UpsertOutcome> {
  return prisma.$transaction(async (tx) => {
    // Prisma TransactionClient tidak persis sama dgn PrismaClient; kita
    // gunakan tipe UpsertTx fleksibel (lihat deklarasi delegate di tx).
    return applyBookingEvent(tx as unknown as UpsertTx, input);
  });
}
