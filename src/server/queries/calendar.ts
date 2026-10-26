/**
 * Query server untuk Kalender Okupansi & Deteksi Bentrok (S4-03 / S10-01).
 *
 * Mengambil data unit kamar, blok booking per saluran OTA, blok iCal (CalendarBlock),
 * dan menjalankan deteksi bentrok jadwal domain (detectCollisions).
 */
import { prisma } from "@/lib/prisma";
import { toStayDate, fromStayDate, addDays, type StayDate } from "@/lib/dates";
import {
  detectScheduleCollisions,
  type CollisionBooking,
  type CollisionBlock,
  type CollisionUnit,
  type CollisionItem,
  type CollisionReport,
} from "@/domain/collision";

export interface CalendarDayCell {
  date: StayDate;
  dayNumber: number;
  dayName: string;
  isWeekend: boolean;
  isToday: boolean;
  isSellable: boolean;
  booking?: {
    id: string;
    externalId: string;
    channel: string;
    status: string;
    guestName?: string;
    checkIn: StayDate;
    checkOut: StayDate;
    grossAmount?: string;
    isFirstNight: boolean;
    isLastNight: boolean;
    nights: number;
    isMultiUnit: boolean;
  } | null;
  block?: {
    id: string;
    summary?: string | null;
    startDate: StayDate;
    endDate: StayDate;
  } | null;
  collision?: {
    severity: "COLLISION" | "WARNING";
    kind: string;
    message: string;
    conflictWith: string;
  } | null;
}

export interface CalendarUnitRow {
  unitId: string;
  unitName: string;
  kind: string;
  propertyId: string;
  propertyName: string;
  days: CalendarDayCell[];
  soldNights: number;
  availableNights: number;
  occupancyRate: number; // 0 - 100
}

export interface CalendarPropertySection {
  propertyId: string;
  propertyName: string;
  units: CalendarUnitRow[];
}

export interface CalendarDataResult {
  year: number;
  month: number;
  monthLabel: string;
  daysInMonth: Array<{
    date: StayDate;
    dayNumber: number;
    dayName: string;
    isWeekend: boolean;
    isToday: boolean;
  }>;
  properties: CalendarPropertySection[];
  collisionReport: CollisionReport;
  stats: {
    totalUnits: number;
    totalAvailableNights: number;
    totalSoldNights: number;
    portfolioOccupancyRate: number;
    totalCollisions: number;
  };
}

const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const INDONESIAN_DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

export async function getCalendarData(input: {
  organizationId: string;
  propertyId?: string | null;
  year: number;
  month: number; // 1 - 12
}): Promise<CalendarDataResult> {
  const { organizationId, propertyId, year, month } = input;

  const validMonth = Math.max(1, Math.min(12, month));
  const monthStr = String(validMonth).padStart(2, "0");
  const lastDayNumber = new Date(Date.UTC(year, validMonth, 0)).getUTCDate();

  const startOfMonth: StayDate = `${year}-${monthStr}-01`;
  const endOfMonth: StayDate = `${year}-${monthStr}-${String(lastDayNumber).padStart(2, "0")}`;
  const nextMonthFirstDate: StayDate = addDays(endOfMonth, 1);

  const todayWita = toStayDate(new Date());

  // 1. Buat daftar metadata hari dalam bulan
  const daysInMonthList: CalendarDataResult["daysInMonth"] = [];
  for (let d = 1; d <= lastDayNumber; d++) {
    const curDateStr: StayDate = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
    const dt = fromStayDate(curDateStr);
    const dayOfWeek = dt.getUTCDay();
    daysInMonthList.push({
      date: curDateStr,
      dayNumber: d,
      dayName: INDONESIAN_DAY_NAMES[dayOfWeek] || "Sen",
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: curDateStr === todayWita,
    });
  }

  // 2. Ambil properti dan unit aktif
  const propertiesData = await prisma.property.findMany({
    where: {
      organizationId,
      ...(propertyId ? { id: propertyId } : {}),
      isActive: true,
    },
    include: {
      units: {
        where: { isActive: true },
        include: {
          inventory: {
            where: {
              validFrom: { lte: fromStayDate(endOfMonth) },
              OR: [{ validTo: null }, { validTo: { gte: fromStayDate(startOfMonth) } }],
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Kumpulkan seluruh unit untuk deteksi collision
  const allUnits = propertiesData.flatMap((p) => p.units);

  // 3. Ambil booking yang beririsan dengan periode bulan ini
  const bookingsData = await prisma.booking.findMany({
    where: {
      organizationId,
      status: { in: ["CONFIRMED", "PENDING"] },
      checkIn: { lt: fromStayDate(nextMonthFirstDate) },
      checkOut: { gt: fromStayDate(startOfMonth) },
    },
    include: {
      units: {
        select: { unitId: true },
      },
      listing: {
        select: { id: true, name: true, channel: true },
      },
      guest: {
        select: { displayName: true },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  // 4. Ambil calendar blocks (iCal) yang beririsan
  const calendarBlocksData = await prisma.calendarBlock.findMany({
    where: {
      listing: { organizationId },
      startDate: { lt: fromStayDate(nextMonthFirstDate) },
      endDate: { gt: fromStayDate(startOfMonth) },
    },
    include: {
      listing: {
        include: {
          listingUnits: { select: { unitId: true } },
        },
      },
    },
  });

  // 5. Jalankan deteksi bentrok jadwal domain
  const collisionBookings: CollisionBooking[] = bookingsData.map((b) => ({
    id: b.id,
    channel: b.channel,
    externalId: b.externalId,
    status: b.status as "CONFIRMED" | "PENDING",
    unitIds: b.units.map((bu) => bu.unitId),
    checkIn: toStayDate(b.checkIn),
    checkOut: toStayDate(b.checkOut),
    listingName: b.listing?.name,
    guestName: b.guest?.displayName ?? undefined,
  }));

  const collisionBlocks: CollisionBlock[] = calendarBlocksData.map((cb) => ({
    id: cb.id,
    listingId: cb.listingId,
    unitIds: cb.listing.listingUnits.map((lu) => lu.unitId),
    startDate: toStayDate(cb.startDate),
    endDate: toStayDate(cb.endDate),
    summary: cb.summary,
    source: cb.source,
  }));

  const collisionUnits: CollisionUnit[] = allUnits.map((u) => ({
    id: u.id,
    name: u.name,
    isSellable: (stayDate: StayDate) => {
      const dt = fromStayDate(stayDate);
      const match = u.inventory.find(
        (inv) => inv.validFrom <= dt && (!inv.validTo || inv.validTo >= dt),
      );
      return match ? match.isSellable : true;
    },
  }));

  const collisionReport = detectScheduleCollisions({
    bookings: collisionBookings.filter((b) => b.checkIn < b.checkOut),
    blocks: collisionBlocks.filter((blk) => blk.startDate < blk.endDate),
    units: collisionUnits,
  });

  // Index collision per unit & tanggal agar cepat lookup saat render sel
  const collisionByUnitDate = new Map<string, CollisionItem>();
  for (const c of [...collisionReport.collisions, ...collisionReport.warnings]) {
    let cur = c.overlapStart;
    while (cur < c.overlapEnd) {
      collisionByUnitDate.set(`${c.unitId}::${cur}`, c);
      cur = addDays(cur, 1);
    }
  }

  // 6. Bentuk grid kalender per properti dan per unit
  let totalAvailableNights = 0;
  let totalSoldNights = 0;
  let totalUnitsCount = 0;

  const propertySections: CalendarPropertySection[] = [];

  for (const prop of propertiesData) {
    const unitRows: CalendarUnitRow[] = [];

    for (const unit of prop.units) {
      totalUnitsCount++;
      const isSellableDate = (dateStr: StayDate) => {
        const dt = fromStayDate(dateStr);
        const match = unit.inventory.find(
          (inv) => inv.validFrom <= dt && (!inv.validTo || inv.validTo >= dt),
        );
        return match ? match.isSellable : true;
      };

      let unitSold = 0;
      let unitAvailable = 0;

      const cells: CalendarDayCell[] = daysInMonthList.map((dayMeta) => {
        const sellable = isSellableDate(dayMeta.date);
        if (sellable) {
          unitAvailable++;
          totalAvailableNights++;
        }

        // Cari booking yang mencakup malam ini [checkIn, checkOut)
        const matchedBooking = bookingsData.find(
          (b) =>
            b.units.some((bu) => bu.unitId === unit.id) &&
            toStayDate(b.checkIn) <= dayMeta.date &&
            toStayDate(b.checkOut) > dayMeta.date,
        );

        let bookingSegment: CalendarDayCell["booking"] = null;
        if (matchedBooking) {
          unitSold++;
          totalSoldNights++;

          const checkInStr = toStayDate(matchedBooking.checkIn);
          const checkOutStr = toStayDate(matchedBooking.checkOut);
          const nights = Math.max(
            1,
            Math.round(
              (fromStayDate(checkOutStr).getTime() - fromStayDate(checkInStr).getTime()) /
                86_400_000,
            ),
          );

          bookingSegment = {
            id: matchedBooking.id,
            externalId: matchedBooking.externalId,
            channel: matchedBooking.channel,
            status: matchedBooking.status,
            guestName: matchedBooking.guest?.displayName ?? undefined,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            grossAmount: matchedBooking.grossAmount?.toString(),
            isFirstNight: checkInStr === dayMeta.date,
            isLastNight: addDays(checkOutStr, -1) === dayMeta.date,
            nights,
            isMultiUnit: matchedBooking.units.length > 1,
          };
        }

        // Cari calendar block iCal yang mencakup tanggal ini
        const matchedBlock = calendarBlocksData.find(
          (cb) =>
            cb.listing.listingUnits.some((lu) => lu.unitId === unit.id) &&
            toStayDate(cb.startDate) <= dayMeta.date &&
            toStayDate(cb.endDate) > dayMeta.date,
        );

        let blockSegment: CalendarDayCell["block"] = null;
        if (matchedBlock) {
          blockSegment = {
            id: matchedBlock.id,
            summary: matchedBlock.summary,
            startDate: toStayDate(matchedBlock.startDate),
            endDate: toStayDate(matchedBlock.endDate),
          };
        }

        // Cek collision pada sel ini
        const cellCollision = collisionByUnitDate.get(`${unit.id}::${dayMeta.date}`);
        let collisionInfo: CalendarDayCell["collision"] = null;
        if (cellCollision) {
          const otherBooking = cellCollision.bookingB;
          const conflictWith = otherBooking
            ? `#${otherBooking.externalId || otherBooking.id}`
            : cellCollision.block
              ? `iCal (${cellCollision.block.summary || "Blokir Eksternal"})`
              : "Unit Tidak Dijual";

          collisionInfo = {
            severity: cellCollision.severity,
            kind: cellCollision.kind,
            message: cellCollision.message,
            conflictWith,
          };
        }

        return {
          date: dayMeta.date,
          dayNumber: dayMeta.dayNumber,
          dayName: dayMeta.dayName,
          isWeekend: dayMeta.isWeekend,
          isToday: dayMeta.isToday,
          isSellable: sellable,
          booking: bookingSegment,
          block: blockSegment,
          collision: collisionInfo,
        };
      });

      const unitOccRate = unitAvailable > 0 ? Math.round((unitSold / unitAvailable) * 100) : 0;

      unitRows.push({
        unitId: unit.id,
        unitName: unit.name,
        kind: unit.kind,
        propertyId: prop.id,
        propertyName: prop.name,
        days: cells,
        soldNights: unitSold,
        availableNights: unitAvailable,
        occupancyRate: unitOccRate,
      });
    }

    propertySections.push({
      propertyId: prop.id,
      propertyName: prop.name,
      units: unitRows,
    });
  }

  const portfolioOccupancyRate =
    totalAvailableNights > 0 ? Math.round((totalSoldNights / totalAvailableNights) * 100) : 0;

  return {
    year,
    month: validMonth,
    monthLabel: `${INDONESIAN_MONTHS[validMonth - 1]} ${year}`,
    daysInMonth: daysInMonthList,
    properties: propertySections,
    collisionReport,
    stats: {
      totalUnits: totalUnitsCount,
      totalAvailableNights,
      totalSoldNights,
      portfolioOccupancyRate,
      totalCollisions: collisionReport.totalIssues,
    },
  };
}
