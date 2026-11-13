/**
 * Unit test helper murni untuk halaman detail booking (S2-07.3).
 */
import { describe, expect, it } from "vitest";

import {
  DIFF_FIELD_LABEL,
  EVENT_TYPE_LABEL,
  formatDiffValue,
  summarizeDiff,
} from "@/lib/booking-detail";

describe("summarizeDiff", () => {
  it("mengembalikan daftar kosong untuk diff yang tidak valid", () => {
    expect(summarizeDiff(null)).toEqual([]);
    expect(summarizeDiff(undefined)).toEqual([]);
    expect(summarizeDiff("bukan objek")).toEqual([]);
    expect(summarizeDiff([1, 2, 3])).toEqual([]);
  });

  it("memetakan field diff ke label Bahasa Indonesia", () => {
    const changes = summarizeDiff({
      status: { from: "PENDING", to: "CONFIRMED" },
      grossAmount: { from: "100.00", to: "150.00" },
    });
    expect(changes).toEqual([
      { field: "status", label: "Status", from: "PENDING", to: "CONFIRMED" },
      {
        field: "grossAmount",
        label: "Nilai booking (gross)",
        from: "100.00",
        to: "150.00",
      },
    ]);
  });

  it("memakai nama field apa adanya bila label tidak dikenal", () => {
    const changes = summarizeDiff({ mysteryField: { from: 1, to: 2 } });
    expect(changes[0]).toEqual({
      field: "mysteryField",
      label: "mysteryField",
      from: "1",
      to: "2",
    });
  });

  it("melewati pasangan yang bukan objek", () => {
    expect(summarizeDiff({ status: "CONFIRMED", nights: { from: 1, to: 2 } })).toEqual([
      { field: "nights", label: "Jumlah malam", from: "1", to: "2" },
    ]);
  });
});

describe("formatDiffValue", () => {
  it('menampilkan "-" untuk nilai kosong', () => {
    expect(formatDiffValue(null)).toBe("-");
    expect(formatDiffValue(undefined)).toBe("-");
    expect(formatDiffValue("")).toBe("-");
    expect(formatDiffValue("   ")).toBe("-");
  });

  it("menampilkan angka dan boolean apa adanya", () => {
    expect(formatDiffValue(3)).toBe("3");
    expect(formatDiffValue(0)).toBe("0");
    expect(formatDiffValue(true)).toBe("true");
  });

  it("menampilkan objek sebagai JSON", () => {
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("label booking", () => {
  it("semua jenis event punya label", () => {
    for (const type of [
      "CREATED",
      "MODIFIED",
      "CANCELLED",
      "NO_SHOW",
      "PAYOUT_LINKED",
      "MANUAL_EDIT",
    ]) {
      expect(EVENT_TYPE_LABEL[type]).toBeTruthy();
    }
  });

  it("semua field diff yang dibandingkan punya label", () => {
    for (const field of [
      "status",
      "checkIn",
      "checkOut",
      "nights",
      "guestsCount",
      "currency",
      "grossAmount",
      "taxesCollected",
      "cancellationFee",
      "commissionAmount",
      "commissionRate",
      "collectType",
      "fxRateToBase",
    ]) {
      expect(DIFF_FIELD_LABEL[field]).toBeTruthy();
    }
  });
});
