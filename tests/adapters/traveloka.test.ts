import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TravelokaCsvAdapter } from "@/adapters/traveloka/csv/adapter";
import { TravelokaEmailAdapter } from "@/adapters/traveloka/email/adapter";
import type { RawInput } from "@/adapters/types";

describe("Traveloka Adapters (S6-03)", () => {
  const csvAdapter = new TravelokaCsvAdapter();
  const emailAdapter = new TravelokaEmailAdapter();

  const csvPath = join(process.cwd(), "fixtures/synthetic/traveloka/csv/bookings-synthetic.csv");
  const csvContent = readFileSync(csvPath, "utf-8");

  const loadEmailFixture = (name: string) => {
    const p = join(process.cwd(), `fixtures/synthetic/traveloka/email/${name}.json`);
    return JSON.parse(readFileSync(p, "utf-8"));
  };

  const confirmedEmail = loadEmailFixture("confirmed-synthetic");
  const cancelledEmail = loadEmailFixture("cancelled-synthetic");

  describe("TravelokaCsvAdapter", () => {
    it("mengenali CSV Traveloka TERA via supports()", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "traveloka_tera_report.csv",
        content: csvContent,
      };
      expect(csvAdapter.supports(input)).toBe(true);
    });

    it("menolak CSV non-Traveloka via supports()", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "generic.csv",
        content: "A,B,C\n1,2,3",
      };
      expect(csvAdapter.supports(input)).toBe(false);
    });

    it("mem-parse CSV reservasi Traveloka dengan akurat", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "traveloka_tera.csv",
        content: csvContent,
      };

      const res = await csvAdapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(2);

      // Event 1: Confirmed
      const ev1 = res.events![0]!;
      expect(ev1.eventType).toBe("CREATED");
      expect(ev1.booking.channel).toBe("TRAVELOKA");
      expect(ev1.booking.externalId).toBe("TVL-554433");
      expect(ev1.booking.guestName).toBe("Agus P.");
      expect(ev1.booking.checkIn).toBe("2026-11-20");
      expect(ev1.booking.checkOut).toBe("2026-11-24");
      expect(ev1.booking.nights).toBe(4);
      expect(ev1.booking.grossAmount).toBe("12000000.00");
      expect(ev1.booking.collectType).toBe("CHANNEL_COLLECT");

      // Event 2: Cancelled & Hotel Collect
      const ev2 = res.events![1]!;
      expect(ev2.eventType).toBe("CANCELLED");
      expect(ev2.booking.externalId).toBe("TVL-554444");
      expect(ev2.booking.status).toBe("CANCELLED");
      expect(ev2.booking.collectType).toBe("HOTEL_COLLECT");
    });
  });

  describe("TravelokaEmailAdapter", () => {
    it("mengenali email dari traveloka.com via supports()", () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: "booking@traveloka.com",
        subject: "Traveloka Voucher",
      };
      expect(emailAdapter.supports(input)).toBe(true);
    });

    it("mem-parse email konfirmasi reservasi Traveloka", async () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: confirmedEmail.from,
        subject: confirmedEmail.subject,
        text: confirmedEmail.text,
      };

      const res = await emailAdapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events![0]!;
      expect(ev.eventType).toBe("CREATED");
      expect(ev.booking.channel).toBe("TRAVELOKA");
      expect(ev.booking.externalId).toBe("TVL-554433");
      expect(ev.booking.guestName).toBe("Agus P.");
      expect(ev.booking.checkIn).toBe("2026-11-20");
      expect(ev.booking.checkOut).toBe("2026-11-24");
      expect(ev.booking.nights).toBe(4);
      expect(ev.booking.grossAmount).toBe("12000000.00");
    });

    it("mem-parse email pembatalan reservasi Traveloka", async () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: cancelledEmail.from,
        subject: cancelledEmail.subject,
        text: cancelledEmail.text,
      };

      const res = await emailAdapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(1);
      const ev = res.events![0]!;
      expect(ev.eventType).toBe("CANCELLED");
      expect(ev.booking.status).toBe("CANCELLED");
      expect(ev.booking.externalId).toBe("TVL-554444");
    });
  });
});
