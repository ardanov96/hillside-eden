/**
 * Query server untuk halaman Booking (S2-07.1).
 *
 * Semua query di sini menerima organizationId dari sesi JWT, bukan dari
 * searchParams, sehingga tidak ada risiko tenant leak lewat URL.
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.2 (filter OTA, properti, status,
 * rentang tanggal menginap/booking, pencarian kode konfirmasi), docs/05 §2
 * (terminologi "Pendapatan bersih (setelah komisi OTA)").
 */
import type { BookingStatus, ChannelCode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/decimal";

/** Filter yang didukung halaman booking (semua opsional). */
export interface BookingFilters {
  /** OTA / channel. */
  channel?: ChannelCode | null;
  propertyId?: string | null;
  status?: BookingStatus | null;
  /** Tanggal check-in >= (StayDate "YYYY-MM-DD"). */
  checkInFrom?: string | null;
  /** Tanggal check-in <= (StayDate). */
  checkInTo?: string | null;
  /** Pencarian kode konfirmasi / externalId. */
  search?: string | null;
}

export type BookingSortKey = "checkIn" | "checkOut" | "grossAmount" | "lastSeenAt";
export type SortDirection = "asc" | "desc";

export interface BookingSort {
  key: BookingSortKey;
  dir: SortDirection;
}

export interface BookingListQuery {
  organizationId: string;
  filters?: BookingFilters;
  sort?: BookingSort;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const BOOKING_STATUSES_UI = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly BookingStatus[];

export const BOOKING_CHANNELS_UI = [
  "AIRBNB",
  "TIKET_COM",
  "TRAVELOKA",
  "EXPEDIA",
  "AGODA",
  "BOOKING_COM",
  "DIRECT",
  "MANUAL",
] as const satisfies readonly ChannelCode[];

/** Satu baris tabel booking (sudah Including nilai turunan untuk UI). */
export interface BookingRow {
  id: string;
  externalId: string;
  channel: ChannelCode;
  status: BookingStatus;
  propertyId: string;
  propertyName: string;
  listingId: string;
  listingName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestsCount: number | null;
  currency: string;
  grossAmount: Decimal;
  /** commissionAmount bila OTA sudah laporkan; null = belum ada. */
  commissionAmount: Decimal | null;
  commissionRate: Decimal | null;
  commissionBasis: string | null;
  cancellationFee: Decimal;
  /** Gross - komisi (bila komisi sudah ada). */
  netAmount: Decimal | null;
  /** Basis komisi: estimasi (rate) atau aktual (nominal dari OTA). */
  commissionIsEstimate: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Apakah ada event CANCELLED (agar UI bisa badge). */
  hasCancellation: boolean;
}

export interface BookingListResult {
  rows: BookingRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Susun klausa where Prisma dari filter UI. */
export function buildBookingWhere(
  organizationId: string,
  filters: BookingFilters = {},
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = { organizationId };

  if (filters.channel) where.channel = filters.channel;
  if (filters.propertyId) where.propertyId = filters.propertyId;
  if (filters.status) where.status = filters.status;

  if (filters.checkInFrom || filters.checkInTo) {
    const gte = filters.checkInFrom ? new Date(`${filters.checkInFrom}T00:00:00Z`) : undefined;
    const lte = filters.checkInTo ? new Date(`${filters.checkInTo}T23:59:59.999Z`) : undefined;
    where.checkIn = {
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
    };
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term.length > 0) {
      // externalId adalah kode konfirmasi OTA (lihat docs/06 §2).
      where.externalId = { contains: term, mode: "insensitive" };
    }
  }

  return where;
}

/** Normalisasi nilai money untuk UI (Decimal, bukan float). */
function toDecimalOrNull(v: Decimal | null | undefined): Decimal | null {
  if (v === null || v === undefined) return null;
  return v;
}

/**
 * Ambil daftar booking untuk tabel.
 * Komisi: bila commissionAmount ada (basis ACTUAL) dipakai untuk net;
 * bila tidak, komisi dihitung dari commissionRate (basis ESTIMATED) supaya
 * net tetap informatif namun ditandai estimasi (lihat AGENTS.md aturan 6).
 */
export async function getBookings(query: BookingListQuery): Promise<BookingListResult> {
  const pageSize = Math.min(Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page ?? 1);
  const where = buildBookingWhere(query.organizationId, query.filters ?? {});

  const sortKey = query.sort?.key ?? "checkIn";
  const sortDir = query.sort?.dir ?? "desc";

  const [total, raw] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { [sortKey]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        externalId: true,
        channel: true,
        status: true,
        propertyId: true,
        property: { select: { name: true } },
        listingId: true,
        listing: { select: { name: true } },
        checkIn: true,
        checkOut: true,
        nights: true,
        guestsCount: true,
        currency: true,
        grossAmount: true,
        commissionAmount: true,
        commissionRate: true,
        commissionBasis: true,
        cancellationFee: true,
        firstSeenAt: true,
        lastSeenAt: true,
        events: {
          where: { type: "CANCELLED" },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  const rows: BookingRow[] = raw.map((b) => {
    const gross = toDecimalOrNull(b.grossAmount) ?? new Decimal(0);
    const commissionAmount = toDecimalOrNull(b.commissionAmount);
    const commissionRate = toDecimalOrNull(b.commissionRate);

    // Basis komisi: ACTUAL bila OTA sudah melaporkan nominal; else ESTIMATED.
    const isActual = commissionAmount !== null;
    const effectiveCommission = isActual
      ? commissionAmount
      : commissionRate !== null
        ? gross.times(commissionRate).toDecimalPlaces(2)
        : null;

    return {
      id: b.id,
      externalId: b.externalId,
      channel: b.channel,
      status: b.status,
      propertyId: b.propertyId,
      propertyName: b.property.name,
      listingId: b.listingId,
      listingName: b.listing.name,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      guestsCount: b.guestsCount,
      currency: b.currency,
      grossAmount: gross,
      commissionAmount,
      commissionRate,
      commissionBasis: b.commissionBasis,
      cancellationFee: toDecimalOrNull(b.cancellationFee) ?? new Decimal(0),
      netAmount: effectiveCommission !== null ? gross.minus(effectiveCommission) : null,
      commissionIsEstimate: !isActual,
      firstSeenAt: b.firstSeenAt,
      lastSeenAt: b.lastSeenAt,
      hasCancellation: b.events.length > 0,
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Detail satu booking untuk panel/drawer (S2-07.3). */
export async function getBookingDetail(
  organizationId: string,
  bookingId: string,
): Promise<BookingDetail | null> {
  const b = await prisma.booking.findFirst({
    where: { id: bookingId, organizationId },
    select: {
      id: true,
      externalId: true,
      channel: true,
      status: true,
      checkIn: true,
      checkOut: true,
      nights: true,
      guestsCount: true,
      currency: true,
      grossAmount: true,
      taxesCollected: true,
      cancellationFee: true,
      commissionAmount: true,
      commissionRate: true,
      commissionBasis: true,
      collectType: true,
      fxRateToBase: true,
      fxRateSource: true,
      bookedAt: true,
      bookedAtIsApprox: true,
      rawPayload: true,
      firstSeenAt: true,
      lastSeenAt: true,
      property: { select: { id: true, name: true } },
      listing: { select: { id: true, name: true, externalId: true, channel: true } },
      guest: { select: { id: true, displayName: true, countryCode: true } },
      units: {
        select: {
          unitId: true,
          allocatedGross: true,
          allocationPct: true,
          unit: { select: { name: true } },
        },
        orderBy: { unitId: "asc" },
      },
      events: {
        select: {
          id: true,
          type: true,
          occurredAt: true,
          diff: true,
          importItemId: true,
          importItem: {
            select: {
              id: true,
              batch: { select: { id: true, filename: true, kind: true, receivedAt: true } },
            },
          },
        },
        orderBy: { occurredAt: "desc" },
      },
    },
  });

  if (!b) return null;

  const gross = toDecimalOrNull(b.grossAmount) ?? new Decimal(0);
  const commissionAmount = toDecimalOrNull(b.commissionAmount);
  const commissionRate = toDecimalOrNull(b.commissionRate);
  const isActual = commissionAmount !== null;
  const effectiveCommission = isActual
    ? commissionAmount
    : commissionRate !== null
      ? gross.times(commissionRate).toDecimalPlaces(2)
      : null;

  return {
    id: b.id,
    externalId: b.externalId,
    channel: b.channel,
    status: b.status,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    guestsCount: b.guestsCount,
    currency: b.currency,
    grossAmount: gross,
    taxesCollected: toDecimalOrNull(b.taxesCollected) ?? new Decimal(0),
    cancellationFee: toDecimalOrNull(b.cancellationFee) ?? new Decimal(0),
    commissionAmount,
    commissionRate,
    commissionBasis: b.commissionBasis,
    commissionIsEstimate: !isActual,
    netAmount: effectiveCommission !== null ? gross.minus(effectiveCommission) : null,
    collectType: b.collectType,
    fxRateToBase: toDecimalOrNull(b.fxRateToBase) ?? new Decimal(1),
    fxRateSource: b.fxRateSource,
    bookedAt: b.bookedAt,
    bookedAtIsApprox: b.bookedAtIsApprox,
    firstSeenAt: b.firstSeenAt,
    lastSeenAt: b.lastSeenAt,
    property: b.property,
    listing: b.listing,
    guest: b.guest,
    rawPayload: b.rawPayload,
    units: b.units.map((u) => ({
      unitId: u.unitId,
      unitName: u.unit.name,
      allocatedGross: toDecimalOrNull(u.allocatedGross) ?? new Decimal(0),
      allocationPct: toDecimalOrNull(u.allocationPct) ?? new Decimal(0),
    })),
    events: b.events.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.occurredAt,
      diff: e.diff,
      importItemId: e.importItemId,
      importBatch: e.importItem?.batch ?? null,
    })),
  };
}

export interface BookingDetail {
  id: string;
  externalId: string;
  channel: ChannelCode;
  status: BookingStatus;
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
  commissionBasis: string | null;
  commissionIsEstimate: boolean;
  netAmount: Decimal | null;
  collectType: string;
  fxRateToBase: Decimal;
  fxRateSource: string | null;
  bookedAt: Date | null;
  bookedAtIsApprox: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  property: { id: string; name: string };
  listing: { id: string; name: string; externalId: string; channel: string };
  guest: { id: string; displayName: string | null; countryCode: string | null } | null;
  rawPayload: unknown;
  units: Array<{
    unitId: string;
    unitName: string;
    allocatedGross: Decimal;
    allocationPct: Decimal;
  }>;
  events: Array<{
    id: string;
    type: string;
    occurredAt: Date;
    diff: unknown;
    importItemId: string | null;
    importBatch: { id: string; filename: string | null; kind: string; receivedAt: Date } | null;
  }>;
}
