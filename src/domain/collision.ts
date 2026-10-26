/**
 * Modul Deteksi Bentrok Jadwal (Schedule Collision Detection).
 * Sumber kebenaran: docs/05 §8 (Deteksi bentrok), docs/03 §3.1 (Langkah 8),
 * docs/07 §2.2 (Kalender okupansi), docs/01 tiket S2-06.
 *
 * Aturan bisnis:
 * 1. Interval menginap [check_in, check_out) half-open inklusif-eksklusif per unit.
 * 2. Dua booking CONFIRMED berbeda pada unit yang sama dengan interval beririsan adalah BENTROK (COLLISION).
 * 3. Booking gabungan (estate) diperluas ke semua unit anggotanya sebelum perbandingan (estate vs unit terdeteksi).
 * 4. CalendarBlock (iCal) ikut dibandingkan; bentrok dengan blok ditandai terpisah: "jadwal terisi tanpa data booking".
 * 5. Booking pada unit yang tidak `isSellable` menghasilkan PERINGATAN (WARNING), bukan bentrok.
 * 6. Booking non-CONFIRMED (CANCELLED, NO_SHOW, PENDING) tidak menyebabkan bentrok jadwal.
 * 7. Turnover di hari yang sama (tamu A checkout di tanggal yang sama dengan tamu B checkin) BUKAN bentrok.
 */

import { daysBetween, eachDayInRange, isStayDate, type StayDate } from "../lib/dates";

export type CollisionSeverity = "COLLISION" | "WARNING";

export type CollisionKind = "BOOKING_VS_BOOKING" | "BOOKING_VS_BLOCK" | "UNSELLABLE_UNIT";

export interface CollisionBooking {
  id: string;
  channel?: string;
  externalId?: string;
  status: "CONFIRMED" | "PENDING" | "CANCELLED" | "NO_SHOW";
  unitIds: readonly string[];
  checkIn: StayDate;
  checkOut: StayDate;
  listingName?: string;
  guestName?: string;
}

export interface CollisionBlock {
  id: string;
  listingId?: string;
  unitIds: readonly string[];
  startDate: StayDate;
  endDate: StayDate;
  summary?: string | null;
  source?: string;
}

export interface CollisionUnit {
  id: string;
  name?: string;
  isSellable?: (date: StayDate) => boolean;
}

export interface CollisionItem {
  id: string;
  unitId: string;
  unitName?: string;
  severity: CollisionSeverity;
  kind: CollisionKind;
  bookingA: CollisionBooking;
  bookingB?: CollisionBooking;
  block?: CollisionBlock;
  overlapStart: StayDate;
  overlapEnd: StayDate;
  overlapNights: number;
  message: string;
}

export interface CollisionReport {
  hasCollisions: boolean;
  hasWarnings: boolean;
  collisions: readonly CollisionItem[];
  warnings: readonly CollisionItem[];
  totalIssues: number;
}

export interface CollisionDetectionInput {
  bookings: readonly CollisionBooking[];
  blocks?: readonly CollisionBlock[];
  units?: readonly CollisionUnit[];
}

/**
 * Menghitung irisan half-open antara dua interval [startA, endA) dan [startB, endB).
 * Mengembalikan null bila tidak beririsan (termasuk endA === startB).
 */
export function calculateIntervalOverlap(
  startA: StayDate,
  endA: StayDate,
  startB: StayDate,
  endB: StayDate,
): { overlapStart: StayDate; overlapEnd: StayDate; overlapNights: number } | null {
  const overlapStart = startA > startB ? startA : startB;
  const overlapEnd = endA < endB ? endA : endB;

  if (overlapStart < overlapEnd) {
    const overlapNights = daysBetween(overlapStart, overlapEnd);
    return { overlapStart, overlapEnd, overlapNights };
  }
  return null;
}

function validateStayDates(checkIn: StayDate, checkOut: StayDate, context: string): void {
  if (!isStayDate(checkIn)) {
    throw new Error(`${context}: checkIn invalid (${checkIn})`);
  }
  if (!isStayDate(checkOut)) {
    throw new Error(`${context}: checkOut invalid (${checkOut})`);
  }
  if (checkIn > checkOut) {
    throw new Error(`${context}: checkOut (${checkOut}) must be > checkIn (${checkIn})`);
  }
}

/**
 * Deteksi bentrok jadwal pada seluruh booking dan kalender blok (docs/05 §8).
 */
export function detectScheduleCollisions(input: CollisionDetectionInput): CollisionReport {
  const { bookings, blocks = [], units = [] } = input;

  const unitMap = new Map<string, CollisionUnit>();
  for (const u of units) {
    unitMap.set(u.id, u);
  }

  // Validasi format tanggal & hanya periksa booking berstatus CONFIRMED
  for (const b of bookings) {
    validateStayDates(b.checkIn, b.checkOut, `Booking ${b.id}`);
  }
  for (const blk of blocks) {
    validateStayDates(blk.startDate, blk.endDate, `Block ${blk.id}`);
  }

  const activeBookings = bookings.filter((b) => b.status === "CONFIRMED" && b.checkIn < b.checkOut);

  // Petakan booking aktif per unitId (booking estate otomatis masuk ke semua unit anggotanya)
  const bookingsByUnit = new Map<string, CollisionBooking[]>();
  for (const b of activeBookings) {
    for (const uid of b.unitIds) {
      const list = bookingsByUnit.get(uid) ?? [];
      list.push(b);
      bookingsByUnit.set(uid, list);
    }
  }

  // Petakan blocks per unitId (abaikan blok 0-malam)
  const blocksByUnit = new Map<string, CollisionBlock[]>();
  for (const blk of blocks) {
    if (blk.startDate >= blk.endDate) continue;
    for (const uid of blk.unitIds) {
      const list = blocksByUnit.get(uid) ?? [];
      list.push(blk);
      blocksByUnit.set(uid, list);
    }
  }

  const collisions: CollisionItem[] = [];
  const warnings: CollisionItem[] = [];

  // Ambil semua unitId yang terlibat
  const allUnitIds = new Set<string>([
    ...bookingsByUnit.keys(),
    ...blocksByUnit.keys(),
    ...unitMap.keys(),
  ]);

  for (const unitId of allUnitIds) {
    const unitObj = unitMap.get(unitId);
    const unitName = unitObj?.name ?? unitId;
    const unitBookings = bookingsByUnit.get(unitId) ?? [];
    const unitBlocks = blocksByUnit.get(unitId) ?? [];

    // 1. Cek Booking vs Booking pada unit ini
    for (let i = 0; i < unitBookings.length; i++) {
      for (let j = i + 1; j < unitBookings.length; j++) {
        const b1 = unitBookings[i]!;
        const b2 = unitBookings[j]!;

        // Hindari bentrok terhadap booking yang sama
        if (b1.id === b2.id) continue;

        const overlap = calculateIntervalOverlap(b1.checkIn, b1.checkOut, b2.checkIn, b2.checkOut);

        if (overlap) {
          const b1Label = b1.externalId ? `${b1.channel ?? "OTA"} (${b1.externalId})` : b1.id;
          const b2Label = b2.externalId ? `${b2.channel ?? "OTA"} (${b2.externalId})` : b2.id;
          const itemId = `bvb:${unitId}:${b1.id < b2.id ? `${b1.id}:${b2.id}` : `${b2.id}:${b1.id}`}:${overlap.overlapStart}`;

          collisions.push({
            id: itemId,
            unitId,
            unitName,
            severity: "COLLISION",
            kind: "BOOKING_VS_BOOKING",
            bookingA: b1,
            bookingB: b2,
            overlapStart: overlap.overlapStart,
            overlapEnd: overlap.overlapEnd,
            overlapNights: overlap.overlapNights,
            message: `Bentrok jadwal antara booking ${b1Label} dan ${b2Label} pada unit ${unitName} (${overlap.overlapStart} s.d. ${overlap.overlapEnd}, ${overlap.overlapNights} malam).`,
          });
        }
      }
    }

    // 2. Cek Booking vs CalendarBlock (iCal) pada unit ini
    for (const b of unitBookings) {
      for (const blk of unitBlocks) {
        const overlap = calculateIntervalOverlap(b.checkIn, b.checkOut, blk.startDate, blk.endDate);

        if (overlap) {
          const bLabel = b.externalId ? `${b.channel ?? "OTA"} (${b.externalId})` : b.id;
          const blkLabel = blk.summary ? `"${blk.summary}"` : blk.id;
          const itemId = `bvbk:${unitId}:${b.id}:${blk.id}:${overlap.overlapStart}`;

          collisions.push({
            id: itemId,
            unitId,
            unitName,
            severity: "COLLISION",
            kind: "BOOKING_VS_BLOCK",
            bookingA: b,
            block: blk,
            overlapStart: overlap.overlapStart,
            overlapEnd: overlap.overlapEnd,
            overlapNights: overlap.overlapNights,
            message: `Jadwal terisi tanpa data booking: booking ${bLabel} bentrok dengan blok kalender ${blkLabel} pada unit ${unitName} (${overlap.overlapStart} s.d. ${overlap.overlapEnd}, ${overlap.overlapNights} malam).`,
          });
        }
      }
    }

    // 3. Peringatan Unit Tidak Dapat Dijual (isSellable === false)
    if (unitObj?.isSellable) {
      for (const b of unitBookings) {
        const nights = eachDayInRange({ start: b.checkIn, end: b.checkOut });
        const unsellableNights = nights.filter((d) => !unitObj.isSellable!(d));

        if (unsellableNights.length > 0) {
          const firstDate = unsellableNights[0]!;
          const lastDate = unsellableNights[unsellableNights.length - 1]!;
          const bLabel = b.externalId ? `${b.channel ?? "OTA"} (${b.externalId})` : b.id;
          const itemId = `unsellable:${unitId}:${b.id}:${firstDate}`;

          warnings.push({
            id: itemId,
            unitId,
            unitName,
            severity: "WARNING",
            kind: "UNSELLABLE_UNIT",
            bookingA: b,
            overlapStart: firstDate,
            overlapEnd: lastDate,
            overlapNights: unsellableNights.length,
            message: `Peringatan ketersediaan: booking ${bLabel} jatuh pada unit ${unitName} yang tidak dapat dijual pada rentang ${firstDate}..${lastDate} (${unsellableNights.length} malam).`,
          });
        }
      }
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    hasWarnings: warnings.length > 0,
    collisions,
    warnings,
    totalIssues: collisions.length + warnings.length,
  };
}

/**
 * Pemeriksaan cepat bentrok jadwal untuk satu booking kandidat terhadap jadwal yang ada.
 */
export function hasScheduleConflict(
  candidate: CollisionBooking,
  existingBookings: readonly CollisionBooking[],
  existingBlocks: readonly CollisionBlock[] = [],
): boolean {
  if (candidate.status !== "CONFIRMED") return false;

  for (const b of existingBookings) {
    if (b.status !== "CONFIRMED" || b.id === candidate.id) continue;
    // Cek apakah ada irisan unitId
    const sharedUnits = candidate.unitIds.filter((uid) => b.unitIds.includes(uid));
    if (sharedUnits.length === 0) continue;

    const overlap = calculateIntervalOverlap(
      candidate.checkIn,
      candidate.checkOut,
      b.checkIn,
      b.checkOut,
    );
    if (overlap) return true;
  }

  for (const blk of existingBlocks) {
    const sharedUnits = candidate.unitIds.filter((uid) => blk.unitIds.includes(uid));
    if (sharedUnits.length === 0) continue;

    const overlap = calculateIntervalOverlap(
      candidate.checkIn,
      candidate.checkOut,
      blk.startDate,
      blk.endDate,
    );
    if (overlap) return true;
  }

  return false;
}
