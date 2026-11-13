import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AgodaCsvAdapter } from "@/adapters/agoda/csv/adapter";
import type { RawInput } from "@/adapters/types";

describe("AgodaCsvAdapter", () => {
  const adapter = new AgodaCsvAdapter();
  const fixturePath = join(
    process.cwd(),
    "fixtures/synthetic/agoda/agoda_reservations_synthetic.csv",
  );
  const fixtureContent = readFileSync(fixturePath, "utf-8");

  describe("supports()", () => {
    it("mengenali CSV Agoda berdasarkan header", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "reservations.csv",
        content: fixtureContent,
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali CSV Agoda berdasarkan nama file", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "agoda_ycs_export.csv",
        content: "Booking ID,Other\n12345,Val",
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali CSV Agoda Partner Portal (Agoda Homes)", () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-sample.csv",
      );
      const realContent = readFileSync(realPath, "utf-8");
      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-20261112035816_7cfdd0d684504cf292b844cb33fb407f.csv",
        content: realContent,
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali ekspor Agoda dengan subset kolom (10 kolom)", () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-filtered.csv",
      );
      const realContent = readFileSync(realPath, "utf-8");
      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-88476723-20261112080519_abc.csv",
        content: realContent,
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali ekspor Agoda minimal (hanya ID + tanggal) bila nama berkas pola Agoda", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-88476723-20261112080519_abc.csv",
        content: "BookingIDExternal_reference_ID,StayDateFrom,StayDateTo\n1,2026-12-30,2027-01-02",
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("tidak mengklaim CSV OTA lain (Traveloka) agar router tidak ambigu", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "bookings-synthetic.csv",
        content:
          "Booking ID,Guest Name,Property,Room Name,Check-in Date,Check-out Date,Nights,Total Amount,Currency,Booking Status,Payment Type\n" +
          "TRV-1,Guest,Prop,Room,01/12/2026,03/12/2026,2,1000000,IDR,Confirmed,Payment Type X",
      };
      expect(adapter.supports(input)).toBe(false);
    });

    it("menolak input non-CSV", () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: "noreply@agoda.com",
        subject: "Booking voucher",
      };
      expect(adapter.supports(input)).toBe(false);
    });

    it("menolak CSV non-Agoda", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "random.csv",
        content: "Col A,Col B\nVal A,Val B",
      };
      expect(adapter.supports(input)).toBe(false);
    });
  });

  describe("parse()", () => {
    it("menolak input selain jenis csv", async () => {
      const input: RawInput = {
        kind: "manual",
        payload: {},
      };
      const res = await adapter.parse(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errorCode).toBe("UNSUPPORTED_FORMAT");
      }
    });

    it("mem-parse CSV Agoda sintetis dengan akurat", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "agoda_reservations.csv",
        content: fixtureContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(4);

      // Baris 1: Confirmed - Agoda Collect
      const ev1 = res.events[0]!;
      expect(ev1.eventType).toBe("CREATED");
      expect(ev1.confidence).toBe("high");
      expect(ev1.booking.channel).toBe("AGODA");
      expect(ev1.booking.externalId).toBe("AG-881920");
      expect(ev1.booking.guestName).toBe("Kenji Sato");
      expect(ev1.booking.listingName).toBe("Estate Whole Villa");
      expect(ev1.booking.checkIn).toBe("2026-11-02");
      expect(ev1.booking.checkOut).toBe("2026-11-06");
      expect(ev1.booking.nights).toBe(4);
      expect(ev1.booking.grossAmount).toBe("25000000.00");
      expect(ev1.booking.commissionAmount).toBe("3750000.00");
      expect(ev1.booking.currency).toBe("IDR");
      expect(ev1.booking.collectType).toBe("CHANNEL_COLLECT");
      expect(ev1.booking.status).toBe("CONFIRMED");

      // Baris 3: Cancelled
      const ev3 = res.events[2]!;
      expect(ev3.eventType).toBe("CANCELLED");
      expect(ev3.booking.externalId).toBe("AG-881922");
      expect(ev3.booking.status).toBe("CANCELLED");
      expect(ev3.booking.guestName).toBe("Lucas Silva");

      // Baris 4: Property Collect
      const ev4 = res.events[3]!;
      expect(ev4.booking.externalId).toBe("AG-881923");
      expect(ev4.booking.collectType).toBe("HOTEL_COLLECT");
      expect(ev4.booking.grossAmount).toBe("7200000.00");
      expect(ev4.booking.commissionAmount).toBe("1080000.00");
    });

    it("mem-parse CSV Agoda Partner Portal (Agoda Homes) riil sesuai golden expected", async () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-sample.csv",
      );
      const expectedPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-sample.expected.json",
      );
      const realContent = readFileSync(realPath, "utf-8");
      const expectedJson = JSON.parse(readFileSync(expectedPath, "utf-8"));

      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-20261112035816_7cfdd0d684504cf292b844cb33fb407f.csv",
        content: realContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events[0]!;
      const expectedEv = expectedJson.events[0]!;

      expect(ev.eventType).toBe(expectedEv.eventType);
      expect(ev.confidence).toBe(expectedEv.confidence);
      expect(ev.booking.channel).toBe(expectedEv.booking.channel);
      expect(ev.booking.externalId).toBe(expectedEv.booking.externalId);
      expect(ev.booking.externalListingId).toBe(expectedEv.booking.externalListingId);
      expect(ev.booking.listingName).toBe(expectedEv.booking.listingName);
      expect(ev.booking.status).toBe(expectedEv.booking.status);
      expect(ev.booking.checkIn).toBe(expectedEv.booking.checkIn);
      expect(ev.booking.checkOut).toBe(expectedEv.booking.checkOut);
      expect(ev.booking.nights).toBe(expectedEv.booking.nights);
      expect(ev.booking.guestsCount).toBe(expectedEv.booking.guestsCount);
      expect(ev.booking.guestName).toBe(expectedEv.booking.guestName);
      expect(ev.booking.collectType).toBe(expectedEv.booking.collectType);
      expect(ev.booking.currency).toBe(expectedEv.booking.currency);
    });

    it("mem-parse CSV Agoda 26-kolom dengan status Dibatalkan (riil golden test)", async () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-cancelled.csv",
      );
      const expectedPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-cancelled.expected.json",
      );
      const realContent = readFileSync(realPath, "utf-8");
      const expectedJson = JSON.parse(readFileSync(expectedPath, "utf-8"));

      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-88476723-20261112080519_2968639daad14d52a65c783f8bf23f8c.csv",
        content: realContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events[0]!;
      const expectedEv = expectedJson.events[0]!;

      expect(ev.eventType).toBe("CANCELLED");
      expect(ev.booking.status).toBe("CANCELLED");
      expect(ev.booking.channel).toBe("AGODA");
      expect(ev.booking.externalId).toBe(expectedEv.booking.externalId);
      expect(ev.booking.externalListingId).toBe("1388437228");
      expect(ev.booking.checkIn).toBe("2026-12-30");
      expect(ev.booking.checkOut).toBe("2027-01-02");
      expect(ev.booking.nights).toBe(3);
      expect(ev.booking.guestsCount).toBe(14);
      expect(ev.booking.collectType).toBe("CHANNEL_COLLECT");
    });

    it("mem-parse ekspor Agoda dengan subset kolom (golden test)", async () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-filtered.csv",
      );
      const expectedPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-filtered.expected.json",
      );
      const realContent = readFileSync(realPath, "utf-8");
      const expectedJson = JSON.parse(readFileSync(expectedPath, "utf-8"));

      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-88476723-20261112080519_abc.csv",
        content: realContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events[0]!;
      const expectedEv = expectedJson.events[0]!;

      expect(ev.eventType).toBe(expectedEv.eventType);
      expect(ev.confidence).toBe(expectedEv.confidence);
      expect(ev.warnings).toEqual(expectedEv.warnings);
      expect(ev.booking.externalId).toBe(expectedEv.booking.externalId);
      expect(ev.booking.externalListingId).toBe(expectedEv.booking.externalListingId);
      expect(ev.booking.status).toBe(expectedEv.booking.status);
      expect(ev.booking.checkIn).toBe(expectedEv.booking.checkIn);
      expect(ev.booking.checkOut).toBe(expectedEv.booking.checkOut);
      expect(ev.booking.nights).toBe(expectedEv.booking.nights);
      expect(ev.booking.guestsCount).toBe(expectedEv.booking.guestsCount);
      expect(ev.booking.guestName).toBe(expectedEv.booking.guestName);
      expect(ev.booking.collectType).toBe(expectedEv.booking.collectType);
      expect(ev.booking.currency).toBe(expectedEv.booking.currency);
      expect(ev.booking.grossAmount).toBe(expectedEv.booking.grossAmount);
    });

    it("mem-parse status Indonesia, model bayar, dan selisih malam (sintetis)", async () => {
      const syntheticPath = join(
        process.cwd(),
        "fixtures/synthetic/agoda/agoda_reservations_filtered_synthetic.csv",
      );
      const expectedPath = join(
        process.cwd(),
        "fixtures/synthetic/agoda/agoda_reservations_filtered_synthetic.expected.json",
      );
      const content = readFileSync(syntheticPath, "utf-8");
      const expectedJson = JSON.parse(readFileSync(expectedPath, "utf-8"));

      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-88476723-20261112080519_abc.csv",
        content,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(expectedJson.events.length);
      res.events.forEach((ev, i) => {
        const expectedEv = expectedJson.events[i]!;
        expect(ev.eventType).toBe(expectedEv.eventType);
        expect(ev.confidence).toBe(expectedEv.confidence);
        expect(ev.warnings).toEqual(expectedEv.warnings);
        expect(ev.booking.status).toBe(expectedEv.booking.status);
        expect(ev.booking.collectType).toBe(expectedEv.booking.collectType);
        expect(ev.booking.nights).toBe(expectedEv.booking.nights);
        expect(ev.booking.externalListingId).toBe(expectedEv.booking.externalListingId);
      });

      // "Tidak datang" -> NO_SHOW, "Menunggu" -> PENDING, "Dikonfirmasi" -> CONFIRMED
      expect(res.events[0]!.booking.status).toBe("CONFIRMED");
      expect(res.events[0]!.eventType).toBe("CREATED");
      expect(res.events[1]!.booking.status).toBe("PENDING");
      expect(res.events[2]!.booking.status).toBe("NO_SHOW");
      expect(res.events[2]!.eventType).toBe("NO_SHOW");

      // "Bayar ke Agoda" -> CHANNEL_COLLECT, "Bayar ke Properti" -> HOTEL_COLLECT
      expect(res.events[0]!.booking.collectType).toBe("CHANNEL_COLLECT");
      expect(res.events[1]!.booking.collectType).toBe("HOTEL_COLLECT");

      // Selisih jumlah malam diberi peringatan, nilai tanggal yang dipakai
      expect(res.events[1]!.booking.nights).toBe(2);
      expect(res.events[1]!.warnings[0]).toContain("Jumlah malam pada berkas");
    });

    it("mem-parse tanggal MM/DD/YYYY (Partner Portal) tanpa menggeser hari", async () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-sample.csv",
      );
      const content = readFileSync(realPath, "utf-8");

      const res = await adapter.parse({ kind: "csv", filename: "sample.csv", content });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // 12/30/2026 -> 2026-12-30 dan 01/02/2027 -> 2027-01-02 (bukan 2027-02-01)
      expect(res.events[0]!.booking.checkIn).toBe("2026-12-30");
      expect(res.events[0]!.booking.checkOut).toBe("2027-01-02");
      expect(res.events[0]!.booking.nights).toBe(3);
    });

    it("tidak memakai kolom kebangsaan sebagai nama tamu", async () => {
      const realPath = join(
        process.cwd(),
        "fixtures/real/agoda/csv/booking-report-agoda-homes-cancelled.csv",
      );
      const content = readFileSync(realPath, "utf-8");

      const res = await adapter.parse({ kind: "csv", filename: "cancelled.csv", content });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const booking = res.events[0]!.booking;
      expect(booking.guestName).toBe("G. L. Loprang");
      expect(booking.countryCode).toBe("ID");
      expect(booking.bookedAt?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    });

    it("mengembalikan error bila kolom tanggal menginap tidak ada", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "booking-report-abc.csv",
        content: "BookingIDExternal_reference_ID,Status\n1,Dikonfirmasi",
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errorCode).toBe("INVALID_VALUE");
        expect(res.message).toContain("tanggal menginap");
      }
    });

    it("mengembalikan error jika header tidak ditemukan", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "invalid.csv",
        content: "Header1,Header2\nValue1,Value2",
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errorCode).toBe("INVALID_VALUE");
      }
    });
  });
});
