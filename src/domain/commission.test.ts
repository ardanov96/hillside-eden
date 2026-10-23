import { describe, it, expect } from "vitest";
import {
  validateCommissionRule,
  findActiveCommissionRule,
  estimateCommission,
  reconcileCommission,
  computeOutstandingHotelCommission,
  type CommissionRuleInput,
} from "./commission";
import { money } from "../lib/money";

describe("Domain: Commission & Reconciliation (Sprint 7)", () => {
  describe("validateCommissionRule", () => {
    it("menerima aturan komisi yang valid", () => {
      expect(() =>
        validateCommissionRule({
          channel: "AIRBNB",
          rate: "0.1500",
          collectType: "CHANNEL_COLLECT",
          validFrom: "2026-01-01",
          validTo: "2026-12-31",
        }),
      ).not.toThrow();
    });

    it("menolak rate negatif atau lebih besar dari 1.0", () => {
      expect(() =>
        validateCommissionRule({
          channel: "AIRBNB",
          rate: "-0.05",
          collectType: "CHANNEL_COLLECT",
          validFrom: "2026-01-01",
        }),
      ).toThrow(/Rate komisi harus di antara/);

      expect(() =>
        validateCommissionRule({
          channel: "AIRBNB",
          rate: "1.25",
          collectType: "CHANNEL_COLLECT",
          validFrom: "2026-01-01",
        }),
      ).toThrow(/Rate komisi harus di antara/);
    });

    it("menolak validTo sebelum validFrom", () => {
      expect(() =>
        validateCommissionRule({
          channel: "AIRBNB",
          rate: "0.15",
          collectType: "CHANNEL_COLLECT",
          validFrom: "2026-12-01",
          validTo: "2026-06-01",
        }),
      ).toThrow(/validTo/);
    });
  });

  describe("findActiveCommissionRule", () => {
    const rules: CommissionRuleInput[] = [
      {
        channel: "AIRBNB",
        rate: "0.1400", // General rule Airbnb 14%
        collectType: "CHANNEL_COLLECT",
        validFrom: "2026-01-01",
      },
      {
        channel: "AIRBNB",
        listingId: "listing-ubud",
        rate: "0.1200", // Specific listing Ubud 12%
        collectType: "CHANNEL_COLLECT",
        validFrom: "2026-01-01",
      },
      {
        channel: "TRAVELOKA",
        rate: "0.1500",
        collectType: "HOTEL_COLLECT",
        validFrom: "2026-01-01",
        validTo: "2026-06-30",
      },
    ];

    it("memilih rule spesifik listing di atas rule channel umum", () => {
      const active = findActiveCommissionRule(rules, {
        channel: "AIRBNB",
        listingId: "listing-ubud",
        date: "2026-05-01",
      });
      expect(active).not.toBeNull();
      expect(active?.rate).toBe("0.1200");
    });

    it("memilih rule channel umum bila listingId tidak memiliki rule spesifik", () => {
      const active = findActiveCommissionRule(rules, {
        channel: "AIRBNB",
        listingId: "listing-other",
        date: "2026-05-01",
      });
      expect(active).not.toBeNull();
      expect(active?.rate).toBe("0.1400");
    });

    it("mengembalikan null jika tanggal di luar rentang validitas", () => {
      const active = findActiveCommissionRule(rules, {
        channel: "TRAVELOKA",
        date: "2026-08-01", // Rule traveloka berakhir 2026-06-30
      });
      expect(active).toBeNull();
    });
  });

  describe("estimateCommission (S7-01 / ADR-004)", () => {
    it("menghitung komisi dan pendapatan bersih berdampingan untuk IDR", () => {
      const gross = money("10000000", "IDR");
      const res = estimateCommission(gross, "0.15");

      expect(res.grossAmount.amount.toString()).toBe("10000000");
      expect(res.commissionAmount.amount.toString()).toBe("1500000");
      expect(res.netAmount.amount.toString()).toBe("8500000");
      expect(res.commissionBasis).toBe("ESTIMATED");
      expect(res.collectType).toBe("CHANNEL_COLLECT");
    });

    it("melakukan pembulatan integer untuk IDR (OD-18: 0 desimal)", () => {
      // 3.333.333 * 0.15 = 499.999,95 -> 500.000
      const gross = money("3333333", "IDR");
      const res = estimateCommission(gross, "0.15");

      expect(res.commissionAmount.amount.toString()).toBe("500000");
      expect(res.netAmount.amount.toString()).toBe("2833333");
    });

    it("menghitung komisi dengan 2 desimal untuk USD", () => {
      const gross = money("150.50", "USD");
      const res = estimateCommission(gross, "0.14");

      // 150.50 * 0.14 = 21.07
      expect(res.commissionAmount.amount.toFixed(2)).toBe("21.07");
      expect(res.netAmount.amount.toFixed(2)).toBe("129.43");
    });
  });

  describe("reconcileCommission (S7-03 / docs/05 §9.6)", () => {
    it("menghitung selisih (golden case: estimasi 15% lalu aktual 14.2%)", () => {
      // Booking gross Rp 2.000.000
      const gross = money("2000000", "IDR");
      const estimated = money("300000", "IDR"); // 15%
      const actual = money("284000", "IDR"); // 14.2%

      const res = reconcileCommission({
        bookingId: "b-01",
        channel: "AIRBNB",
        externalId: "HM12345",
        grossAmount: gross,
        estimatedCommission: estimated,
        actualCommission: actual,
      });

      // Variance = actual - estimated = 284.000 - 300.000 = -16.000 (hemat Rp 16.000)
      expect(res.variance.amount.toString()).toBe("-16000");
      expect(res.status).toBe("DISCREPANCY");
      expect(res.effectiveRate.toFixed(4)).toBe("0.1420");
    });

    it("menandai MATCHED bila actual persis sama dengan estimasi", () => {
      const gross = money("1000000", "IDR");
      const commission = money("150000", "IDR");

      const res = reconcileCommission({
        bookingId: "b-02",
        channel: "TIKET_COM",
        externalId: "TKT-123",
        grossAmount: gross,
        estimatedCommission: commission,
        actualCommission: commission,
      });

      expect(res.variance.amount.isZero()).toBe(true);
      expect(res.status).toBe("MATCHED");
    });
  });

  describe("computeOutstandingHotelCommission (S7-04 / docs/05 §9.7)", () => {
    it("menghitung komisi terutang hotel collect (gross Rp 2.000.000, komisi Rp 300.000)", () => {
      const bookings = [
        {
          channel: "TRAVELOKA" as const,
          grossAmount: money("2000000", "IDR"),
          commissionAmount: money("300000", "IDR"),
          collectType: "HOTEL_COLLECT" as const,
          isPaidToOta: false,
        },
        {
          channel: "TRAVELOKA" as const,
          grossAmount: money("3000000", "IDR"),
          commissionAmount: money("450000", "IDR"),
          collectType: "HOTEL_COLLECT" as const,
          isPaidToOta: false,
        },
        {
          channel: "AIRBNB" as const,
          grossAmount: money("5000000", "IDR"),
          commissionAmount: money("700000", "IDR"),
          collectType: "CHANNEL_COLLECT" as const, // diabaikan karena bukan hotel collect
          isPaidToOta: false,
        },
      ];

      const summaries = computeOutstandingHotelCommission(bookings);
      const tvl = summaries.get("TRAVELOKA");

      expect(tvl).toBeDefined();
      expect(tvl?.bookingCount).toBe(2);
      expect(tvl?.totalGrossCollected.amount.toString()).toBe("5000000");
      expect(tvl?.totalCommissionPayable.amount.toString()).toBe("750000");

      // Airbnb tidak masuk saldo terutang
      expect(summaries.get("AIRBNB")).toBeUndefined();
    });
  });
});
