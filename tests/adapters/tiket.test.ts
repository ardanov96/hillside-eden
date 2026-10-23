import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TiketCsvAdapter } from "@/adapters/tiket/csv/adapter";
import { TiketEmailAdapter } from "@/adapters/tiket/email/adapter";
import type { RawInput } from "@/adapters/types";

describe("Tiket.com Adapters (S6-02)", () => {
  const csvAdapter = new TiketCsvAdapter();
  const emailAdapter = new TiketEmailAdapter();

  const csvPath = join(process.cwd(), "fixtures/synthetic/tiket/csv/bookings-synthetic.csv");
  const csvContent = readFileSync(csvPath, "utf-8");

  const loadEmailFixture = (name: string) => {
    const p = join(process.cwd(), `fixtures/synthetic/tiket/email/${name}.json`);
    return JSON.parse(readFileSync(p, "utf-8"));
  };

  const confirmedEmail = loadEmailFixture("confirmed-synthetic");
  const cancelledEmail = loadEmailFixture("cancelled-synthetic");

  describe("TiketCsvAdapter", () => {
    it("mengenali CSV Tiket.com via supports()", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "tiket_orders.csv",
        content: csvContent,
      };
      expect(csvAdapter.supports(input)).toBe(true);
    });

    it("menolak CSV non-Tiket via supports()", () => {
      const input: RawInput = {
        kind: "csv",
        filename: "other.csv",
        content: "Col1,Col2\nVal1,Val2",
      };
      expect(csvAdapter.supports(input)).toBe(false);
    });

    it("mem-parse CSV reservasi Tiket.com dengan akurat", async () => {
      const input: RawInput = {
        kind: "csv",
        filename: "tiket_orders.csv",
        content: csvContent,
      };

      const res = await csvAdapter.parse(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.events).toHaveLength(2);

      // Event 1: Confirmed
      const ev1 = res.events![0]!;
      expect(ev1.eventType).toBe("CREATED");
      expect(ev1.booking.channel).toBe("TIKET_COM");
      expect(ev1.booking.externalId).toBe("TKT-991122");
      expect(ev1.booking.guestName).toBe("Budi S.");
      expect(ev1.booking.checkIn).toBe("2026-11-05");
      expect(ev1.booking.checkOut).toBe("2026-11-08");
      expect(ev1.booking.nights).toBe(3);
      expect(ev1.booking.grossAmount).toBe("9500000.00");
      expect(ev1.booking.collectType).toBe("CHANNEL_COLLECT");

      // Event 2: Cancelled
      const ev2 = res.events![1]!;
      expect(ev2.eventType).toBe("CANCELLED");
      expect(ev2.booking.externalId).toBe("TKT-991133");
      expect(ev2.booking.status).toBe("CANCELLED");
    });
  });

  describe("TiketEmailAdapter", () => {
    it("mengenali email dari tiket.com via supports()", () => {
      const input: RawInput = {
        kind: "email",
        receivedAt: new Date(),
        from: "notification@tiket.com",
        subject: "Booking Confirmation",
      };
      expect(emailAdapter.supports(input)).toBe(true);
    });

    it("mem-parse email konfirmasi reservasi Tiket.com", async () => {
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
      expect(ev.booking.channel).toBe("TIKET_COM");
      expect(ev.booking.externalId).toBe("TKT-991122");
      expect(ev.booking.guestName).toBe("Budi S.");
      expect(ev.booking.checkIn).toBe("2026-11-05");
      expect(ev.booking.checkOut).toBe("2026-11-08");
      expect(ev.booking.nights).toBe(3);
      expect(ev.booking.grossAmount).toBe("9500000.00");
    });

    it("mem-parse email pembatalan reservasi Tiket.com", async () => {
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
      expect(ev.booking.externalId).toBe("TKT-991133");
    });
  });
});
