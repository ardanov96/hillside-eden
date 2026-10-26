import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BookingComCsvAdapter } from "@/adapters/booking_com/csv/adapter";
import type { RawInput } from "@/adapters/types";

describe("BookingComCsvAdapter", () => {
  const adapter = new BookingComCsvAdapter();
  const fixturePath = join(
    process.cwd(),
    "fixtures/synthetic/booking_com/booking_com_reservations_synthetic.csv",
  );
  const fixtureContent = readFileSync(fixturePath, "utf-8");

  describe("supports()", () => {
    it("mengenali CSV Booking.com berdasarkan header", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "reservations.csv",
        content: fixtureContent,
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali CSV Booking.com berdasarkan nama file", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "booking_com_export.csv",
        content: "Book number,Other\n12345,Val",
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("menolak input non-CSV", () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: "noreply@booking.com",
        subject: "New booking",
      };
      expect(adapter.supports(input)).toBe(false);
    });

    it("menolak CSV non-Booking.com", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "random.csv",
        content: "Column A,Column B\nVal 1,Val 2",
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

    it("mem-parse CSV Booking.com sintetis dengan akurat", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "booking_com_reservations.csv",
        content: fixtureContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(4);

      // Baris 1: Confirmed - Channel Collect (Online Payments)
      const ev1 = res.events[0]!;
      expect(ev1.eventType).toBe("CREATED");
      expect(ev1.confidence).toBe("high");
      expect(ev1.booking.channel).toBe("BOOKING_COM");
      expect(ev1.booking.externalId).toBe("BK-2026-9011");
      expect(ev1.booking.guestName).toBe("Michael Green");
      expect(ev1.booking.listingName).toBe("Master Suite Villa");
      expect(ev1.booking.checkIn).toBe("2026-11-01");
      expect(ev1.booking.checkOut).toBe("2026-11-04");
      expect(ev1.booking.nights).toBe(3);
      expect(ev1.booking.grossAmount).toBe("12000000.00");
      expect(ev1.booking.commissionAmount).toBe("1800000.00");
      expect(ev1.booking.currency).toBe("IDR");
      expect(ev1.booking.collectType).toBe("CHANNEL_COLLECT");
      expect(ev1.booking.status).toBe("CONFIRMED");

      // Baris 3: Cancelled
      const ev3 = res.events[2]!;
      expect(ev3.eventType).toBe("CANCELLED");
      expect(ev3.booking.externalId).toBe("BK-2026-9013");
      expect(ev3.booking.status).toBe("CANCELLED");
      expect(ev3.booking.guestName).toBe("Daniel Lee");

      // Baris 4: Hotel Collect (Pay at Hotel)
      const ev4 = res.events[3]!;
      expect(ev4.booking.externalId).toBe("BK-2026-9014");
      expect(ev4.booking.collectType).toBe("HOTEL_COLLECT");
      expect(ev4.booking.grossAmount).toBe("11500000.00");
      expect(ev4.booking.commissionAmount).toBe("1725000.00");
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

    it("mem-parse CSV dengan pemisah ribuan titik Indonesia dan tanggal garis miring (DD/MM/YYYY)", async () => {
      const localizedCsv = `Book number,Check-in,Check-out,Guest name,Room type,Total amount,Commission,Status,Payment status,Currency
BK-LOC-01,05/11/2026,08/11/2026,Budi Santoso,Master Suite,15.000.000,2.250.000,ok,Online Payments,IDR`;

      const input: RawInput = {
        kind: "csv",
        filename: "booking_local.csv",
        content: localizedCsv,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events[0]!;
      expect(ev.booking.checkIn).toBe("2026-11-05");
      expect(ev.booking.checkOut).toBe("2026-11-08");
      expect(ev.booking.nights).toBe(3);
      expect(ev.booking.grossAmount).toBe("15000000.00");
      expect(ev.booking.commissionAmount).toBe("2250000.00");
    });
  });
});
