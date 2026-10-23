import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AirbnbCsvAdapter } from "@/adapters/airbnb/csv/adapter";
import type { RawInput } from "@/adapters/types";

describe("Airbnb CSV Adapter (S5-02)", () => {
  const adapter = new AirbnbCsvAdapter();

  const reservationsCsvPath = join(
    process.cwd(),
    "fixtures/synthetic/airbnb/csv/reservations-synthetic.csv",
  );
  const reservationsContent = readFileSync(reservationsCsvPath, "utf-8");

  const payoutsCsvPath = join(
    process.cwd(),
    "fixtures/synthetic/airbnb/csv/payout-transactions-synthetic.csv",
  );
  const payoutsContent = readFileSync(payoutsCsvPath, "utf-8");

  it("mengenali header ekspor reservasi Airbnb via supports()", () => {
    const input: RawInput = {
      kind: "csv",
      filename: "airbnb_reservations.csv",
      content: reservationsContent,
    };
    expect(adapter.supports(input)).toBe(true);
  });

  it("mengenali header ekspor payout Airbnb via supports()", () => {
    const input: RawInput = {
      kind: "csv",
      filename: "airbnb_payouts.csv",
      content: payoutsContent,
    };
    expect(adapter.supports(input)).toBe(true);
  });

  it("menolak berkas CSV non-Airbnb via supports()", () => {
    const input: RawInput = {
      kind: "csv",
      filename: "expenses.csv",
      content: "Tanggal,Kategori,Nominal,Keterangan\n2026-10-01,Listrik,500000,PLN",
    };
    expect(adapter.supports(input)).toBe(false);
  });

  it("mem-parse CSV reservasi sintetis sesuai golden file expected (S5-01 / S5-02)", async () => {
    const input: RawInput = {
      kind: "csv",
      filename: "reservations.csv",
      content: reservationsContent,
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.events).toHaveLength(2);

    // Event 1: Confirmed
    expect(res.events![0]!.eventType).toBe("CREATED");
    expect(res.events![0]!.booking.externalId).toBe("HM12345678");
    expect(res.events![0]!.booking.status).toBe("CONFIRMED");
    expect(res.events![0]!.booking.checkIn).toBe("2026-11-01");
    expect(res.events![0]!.booking.checkOut).toBe("2026-11-05");
    expect(res.events![0]!.booking.nights).toBe(4);
    expect(res.events![0]!.booking.grossAmount).toBe("8500000.00");
    expect(res.events![0]!.booking.channel).toBe("AIRBNB");

    // Event 2: Cancelled
    expect(res.events![1]!.eventType).toBe("CANCELLED");
    expect(res.events![1]!.booking.externalId).toBe("HM87654321");
    expect(res.events![1]!.booking.status).toBe("CANCELLED");
    expect(res.events![1]!.booking.checkIn).toBe("2026-11-10");
    expect(res.events![1]!.booking.checkOut).toBe("2026-11-12");
  });

  it("mem-parse CSV transaksi payout sintetis sesuai golden file expected (S5-01 / S5-02)", async () => {
    const input: RawInput = {
      kind: "csv",
      filename: "payouts.csv",
      content: payoutsContent,
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.payouts).toBeDefined();
    expect(res.payouts).toHaveLength(1);

    const payout = res.payouts?.[0];
    expect(payout).toBeDefined();
    if (!payout) return;

    expect(payout.channel).toBe("AIRBNB");
    expect(payout.reference).toBe("P-999888");
    expect(payout.amount).toBe("8500000.00");
    expect(payout.currency).toBe("IDR");
    expect(payout.payoutDate).toBe("2026-11-03");
    expect(payout.bookingExternalIds).toContain("HM12345678");
  });
});
