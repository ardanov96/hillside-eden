import { describe, it, expect } from "vitest";
import {
  calculateIntervalOverlap,
  detectScheduleCollisions,
  hasScheduleConflict,
  type CollisionBlock,
  type CollisionBooking,
  type CollisionUnit,
} from "./collision";

describe("domain/collision (S2-06: Deteksi bentrok jadwal)", () => {
  describe("calculateIntervalOverlap (irisan interval half-open)", () => {
    it("menghitung irisan dua interval yang bertumpuk", () => {
      const overlap = calculateIntervalOverlap(
        "2026-10-10",
        "2026-10-15",
        "2026-10-12",
        "2026-10-18",
      );
      expect(overlap).not.toBeNull();
      expect(overlap?.overlapStart).toBe("2026-10-12");
      expect(overlap?.overlapEnd).toBe("2026-10-15");
      expect(overlap?.overlapNights).toBe(3);
    });

    it("turnover di hari yang sama (endA === startB) bukan bentrok (return null)", () => {
      const overlap = calculateIntervalOverlap(
        "2026-10-10",
        "2026-10-15",
        "2026-10-15",
        "2026-10-20",
      );
      expect(overlap).toBeNull();
    });

    it("interval yang berjauhan (tidak beririsan) return null", () => {
      const overlap = calculateIntervalOverlap(
        "2026-10-01",
        "2026-10-05",
        "2026-10-10",
        "2026-10-15",
      );
      expect(overlap).toBeNull();
    });
  });

  describe("Estate vs Unit Collision (Kriteria Selesai Tiket S2-06)", () => {
    it("mendeteksi bentrok antara booking paket estate dan booking unit kamar individual", () => {
      const estateBooking: CollisionBooking = {
        id: "b-estate",
        channel: "AIRBNB",
        externalId: "HM-ESTATE-01",
        status: "CONFIRMED",
        unitIds: ["villa-utama", "cottage-1", "cottage-2"],
        checkIn: "2026-10-20",
        checkOut: "2026-10-25",
        listingName: "Hillside Eden Entire Jungle Estate",
      };

      const roomBooking: CollisionBooking = {
        id: "b-room",
        channel: "TIKET_COM",
        externalId: "TC-VILLA-02",
        status: "CONFIRMED",
        unitIds: ["villa-utama"],
        checkIn: "2026-10-22",
        checkOut: "2026-10-24",
        listingName: "Hillside Eden Main Villa Only",
      };

      const units: CollisionUnit[] = [
        { id: "villa-utama", name: "Main Villa" },
        { id: "cottage-1", name: "Cottage 1" },
        { id: "cottage-2", name: "Cottage 2" },
      ];

      const report = detectScheduleCollisions({
        bookings: [estateBooking, roomBooking],
        units,
      });

      expect(report.hasCollisions).toBe(true);
      expect(report.collisions).toHaveLength(1);

      const col = report.collisions[0]!;
      expect(col.unitId).toBe("villa-utama");
      expect(col.kind).toBe("BOOKING_VS_BOOKING");
      expect(col.severity).toBe("COLLISION");
      expect(col.overlapStart).toBe("2026-10-22");
      expect(col.overlapEnd).toBe("2026-10-24");
      expect(col.overlapNights).toBe(2);
      expect(col.message).toContain("HM-ESTATE-01");
      expect(col.message).toContain("TC-VILLA-02");
    });
  });

  describe("Booking vs CalendarBlock (iCal)", () => {
    it("mendeteksi bentrok dengan iCal dan menandai 'Jadwal terisi tanpa data booking'", () => {
      const booking: CollisionBooking = {
        id: "b1",
        channel: "MANUAL",
        externalId: "MN-101",
        status: "CONFIRMED",
        unitIds: ["cottage-1"],
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
      };

      const block: CollisionBlock = {
        id: "ical-blk-99",
        unitIds: ["cottage-1"],
        startDate: "2026-11-03",
        endDate: "2026-11-07",
        summary: "Airbnb External Calendar Block",
      };

      const report = detectScheduleCollisions({
        bookings: [booking],
        blocks: [block],
      });

      expect(report.hasCollisions).toBe(true);
      expect(report.collisions).toHaveLength(1);
      const col = report.collisions[0]!;
      expect(col.kind).toBe("BOOKING_VS_BLOCK");
      expect(col.overlapStart).toBe("2026-11-03");
      expect(col.overlapEnd).toBe("2026-11-05");
      expect(col.overlapNights).toBe(2);
      expect(col.message).toContain("Jadwal terisi tanpa data booking");
    });
  });

  describe("Status Booking dan Pengecualian", () => {
    it("booking CANCELLED, NO_SHOW, dan PENDING diabaikan dari bentrok", () => {
      const confirmedBooking: CollisionBooking = {
        id: "b-conf",
        status: "CONFIRMED",
        unitIds: ["room-1"],
        checkIn: "2026-10-10",
        checkOut: "2026-10-15",
      };

      const cancelledBooking: CollisionBooking = {
        id: "b-canc",
        status: "CANCELLED",
        unitIds: ["room-1"],
        checkIn: "2026-10-12",
        checkOut: "2026-10-14",
      };

      const pendingBooking: CollisionBooking = {
        id: "b-pend",
        status: "PENDING",
        unitIds: ["room-1"],
        checkIn: "2026-10-11",
        checkOut: "2026-10-13",
      };

      const report = detectScheduleCollisions({
        bookings: [confirmedBooking, cancelledBooking, pendingBooking],
      });

      expect(report.hasCollisions).toBe(false);
      expect(report.collisions).toHaveLength(0);
    });

    it("booking pada unit berbeda tidak menyebabkan bentrok", () => {
      const bookingA: CollisionBooking = {
        id: "b-a",
        status: "CONFIRMED",
        unitIds: ["room-1"],
        checkIn: "2026-10-10",
        checkOut: "2026-10-15",
      };
      const bookingB: CollisionBooking = {
        id: "b-b",
        status: "CONFIRMED",
        unitIds: ["room-2"],
        checkIn: "2026-10-10",
        checkOut: "2026-10-15",
      };

      const report = detectScheduleCollisions({
        bookings: [bookingA, bookingB],
      });

      expect(report.hasCollisions).toBe(false);
    });
  });

  describe("Peringatan Unit Tidak Dapat Dijual (isSellable)", () => {
    it("menghasilkan WARNING saat booking jatuh di tanggal unit ditandai tidak dijual", () => {
      const booking: CollisionBooking = {
        id: "b-unsellable",
        externalId: "TC-99",
        status: "CONFIRMED",
        unitIds: ["room-4"],
        checkIn: "2026-10-01",
        checkOut: "2026-10-05",
      };

      const unit: CollisionUnit = {
        id: "room-4",
        name: "Kamar 4 (Renovasi)",
        isSellable: (date) => date !== "2026-10-02" && date !== "2026-10-03",
      };

      const report = detectScheduleCollisions({
        bookings: [booking],
        units: [unit],
      });

      expect(report.hasCollisions).toBe(false); // Bukan bentrok
      expect(report.hasWarnings).toBe(true); // Tapi menghasilkan warning
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]!.kind).toBe("UNSELLABLE_UNIT");
      expect(report.warnings[0]!.severity).toBe("WARNING");
      expect(report.warnings[0]!.overlapNights).toBe(2);
    });
  });

  describe("hasScheduleConflict (pemeriksaan cepat)", () => {
    const existing: CollisionBooking[] = [
      {
        id: "ex-1",
        status: "CONFIRMED",
        unitIds: ["villa-1"],
        checkIn: "2026-12-01",
        checkOut: "2026-12-05",
      },
    ];

    it("mengembalikan true jika kandidat bertabrakan dengan jadwal aktif", () => {
      const candidate: CollisionBooking = {
        id: "cand-1",
        status: "CONFIRMED",
        unitIds: ["villa-1"],
        checkIn: "2026-12-03",
        checkOut: "2026-12-07",
      };
      expect(hasScheduleConflict(candidate, existing)).toBe(true);
    });

    it("mengembalikan false jika turnover di tanggal yang sama", () => {
      const candidate: CollisionBooking = {
        id: "cand-2",
        status: "CONFIRMED",
        unitIds: ["villa-1"],
        checkIn: "2026-12-05",
        checkOut: "2026-12-10",
      };
      expect(hasScheduleConflict(candidate, existing)).toBe(false);
    });

    it("mengembalikan false jika kandidat berstatus bukan CONFIRMED", () => {
      const candidate: CollisionBooking = {
        id: "cand-3",
        status: "PENDING",
        unitIds: ["villa-1"],
        checkIn: "2026-12-02",
        checkOut: "2026-12-04",
      };
      expect(hasScheduleConflict(candidate, existing)).toBe(false);
    });
  });

  describe("Validasi Input", () => {
    it("melempar error jika checkIn atau checkOut tidak valid", () => {
      const badDateBooking: CollisionBooking = {
        id: "b-bad",
        status: "CONFIRMED",
        unitIds: ["u1"],
        checkIn: "2026-13-99",
        checkOut: "2026-10-10",
      };
      expect(() => detectScheduleCollisions({ bookings: [badDateBooking] })).toThrow(
        /checkIn invalid/,
      );
    });

    it("melempar error jika checkOut < checkIn (tanggal terbalik)", () => {
      const reversedBooking: CollisionBooking = {
        id: "b-rev",
        status: "CONFIRMED",
        unitIds: ["u1"],
        checkIn: "2026-10-15",
        checkOut: "2026-10-10",
      };
      expect(() => detectScheduleCollisions({ bookings: [reversedBooking] })).toThrow(
        /checkOut .* must be > checkIn/,
      );
    });

    it("tidak melempar error pada reservasi transit / day-use dengan checkIn === checkOut", () => {
      const transitBooking: CollisionBooking = {
        id: "b-transit",
        status: "CONFIRMED",
        unitIds: ["u1"],
        checkIn: "2026-10-15",
        checkOut: "2026-10-15",
      };
      const report = detectScheduleCollisions({ bookings: [transitBooking] });
      expect(report.hasCollisions).toBe(false);
      expect(report.collisions).toHaveLength(0);
    });
  });
});
