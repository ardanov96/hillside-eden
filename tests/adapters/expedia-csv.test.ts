import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExpediaCsvAdapter } from "@/adapters/expedia/csv/adapter";
import type { RawInput } from "@/adapters/types";

describe("ExpediaCsvAdapter", () => {
  const adapter = new ExpediaCsvAdapter();
  const fixturePath = join(
    process.cwd(),
    "fixtures/synthetic/expedia/expedia_reservations_synthetic.csv",
  );
  const fixtureContent = readFileSync(fixturePath, "utf-8");

  describe("supports()", () => {
    it("mengenali CSV Expedia berdasarkan header", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "reservations.csv",
        content: fixtureContent,
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("mengenali CSV Expedia berdasarkan nama file", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "expedia_partner_central.csv",
        content: "Reservation ID,Other\n12345,Val",
      };
      expect(adapter.supports(input)).toBe(true);
    });

    it("menolak input non-CSV", () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: "noreply@expedia.com",
        subject: "New booking notification",
      };
      expect(adapter.supports(input)).toBe(false);
    });

    it("menolak CSV non-Expedia", () => {
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

    it("mem-parse CSV Expedia sintetis dengan akurat", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "expedia_reservations.csv",
        content: fixtureContent,
      };

      const res = await adapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(4);

      // Baris 1: Confirmed - Expedia Collect
      const ev1 = res.events[0]!;
      expect(ev1.eventType).toBe("CREATED");
      expect(ev1.confidence).toBe("high");
      expect(ev1.booking.channel).toBe("EXPEDIA");
      expect(ev1.booking.externalId).toBe("EXP-772101");
      expect(ev1.booking.guestName).toBe("David Miller");
      expect(ev1.booking.listingName).toBe("Master Suite Villa");
      expect(ev1.booking.checkIn).toBe("2026-11-04");
      expect(ev1.booking.checkOut).toBe("2026-11-08");
      expect(ev1.booking.nights).toBe(4);
      expect(ev1.booking.grossAmount).toBe("15000000.00");
      expect(ev1.booking.commissionAmount).toBe("2250000.00");
      expect(ev1.booking.currency).toBe("IDR");
      expect(ev1.booking.collectType).toBe("CHANNEL_COLLECT");
      expect(ev1.booking.status).toBe("CONFIRMED");

      // Baris 3: Cancelled
      const ev3 = res.events[2]!;
      expect(ev3.eventType).toBe("CANCELLED");
      expect(ev3.booking.externalId).toBe("EXP-772103");
      expect(ev3.booking.status).toBe("CANCELLED");
      expect(ev3.booking.guestName).toBe("Carlos Gomez");

      // Baris 4: Hotel Collect
      const ev4 = res.events[3]!;
      expect(ev4.booking.externalId).toBe("EXP-772104");
      expect(ev4.booking.collectType).toBe("HOTEL_COLLECT");
      expect(ev4.booking.grossAmount).toBe("6900000.00");
      expect(ev4.booking.commissionAmount).toBe("1035000.00");
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
