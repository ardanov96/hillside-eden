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
