import { describe, it, expect } from "vitest";
import {
  WITA,
  isStayDate,
  assertStayDate,
  toStayDate,
  addDays,
  subDays,
  daysBetween,
  nightsBetween,
  compareStayDate,
  rangesOverlap,
  isInRange,
  eachDayInRange,
  nightsInPeriod,
  monthOf,
  startOfMonth,
  endOfMonth,
  formatStayDateId,
  formatMonthId,
  formatTimestampWITA,
  parseStayDate,
} from "./dates";

describe("dates", () => {
  describe("WITA timezone", () => {
    it("exposes the canonical timezone identifier", () => {
      expect(WITA).toBe("Asia/Makassar");
    });
    it("toStayDate maps UTC to WITA (UTC+8, no DST)", () => {
      expect(toStayDate(new Date("2026-10-19T20:00:00Z"))).toBe("2026-10-20");
      expect(toStayDate(new Date("2026-10-19T15:59:00Z"))).toBe("2026-10-19");
      expect(toStayDate(new Date("2026-10-19T16:00:00Z"))).toBe("2026-10-20");
    });
    it("formatTimestampWITA renders WITA label", () => {
      const out = formatTimestampWITA(new Date("2026-10-19T16:30:00Z"));
      expect(out).toMatch(/2026-10-20 00:30 WITA/);
    });
  });

  describe("isStayDate / assertStayDate", () => {
    it("accepts valid YYYY-MM-DD", () => {
      expect(isStayDate("2026-10-19")).toBe(true);
      expect(isStayDate("2024-02-29")).toBe(true);
    });
    it("rejects invalid format / out-of-range", () => {
      expect(isStayDate("2026-13-01")).toBe(false);
      expect(isStayDate("2026-02-30")).toBe(false);
      expect(isStayDate("2023-02-29")).toBe(false);
      expect(isStayDate("19-10-2026")).toBe(false);
      expect(isStayDate("")).toBe(false);
    });
    it("assertStayDate throws on invalid", () => {
      expect(() => assertStayDate("bogus")).toThrow(/Invalid stay date/);
    });
  });

  describe("addDays / subDays", () => {
    it("adds and subtracts days across month/year", () => {
      expect(addDays("2026-10-19", 1)).toBe("2026-10-20");
      expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
      expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
      expect(subDays("2026-03-01", 1)).toBe("2026-02-28");
    });
    it("throws on non-integer n", () => {
      expect(() => addDays("2026-10-19", 1.5)).toThrow();
    });
  });

  describe("daysBetween / nightsBetween / compareStayDate", () => {
    it("daysBetween counts whole days", () => {
      expect(daysBetween("2026-10-19", "2026-10-19")).toBe(0);
      expect(daysBetween("2026-10-19", "2026-10-26")).toBe(7);
      expect(daysBetween("2026-10-26", "2026-10-19")).toBe(-7);
    });
    it("nightsBetween uses end - start (>= 0)", () => {
      expect(nightsBetween("2026-10-19", "2026-10-22")).toBe(3);
      expect(nightsBetween("2026-10-22", "2026-10-19")).toBe(0);
    });
    it("compareStayDate returns -1/0/1", () => {
      expect(compareStayDate("2026-10-19", "2026-10-20")).toBe(-1);
      expect(compareStayDate("2026-10-20", "2026-10-19")).toBe(1);
      expect(compareStayDate("2026-10-20", "2026-10-20")).toBe(0);
    });
  });

  describe("DateRange helpers", () => {
    it("rangesOverlap (half-open)", () => {
      const a = { start: "2026-10-10", end: "2026-10-15" };
      const b = { start: "2026-10-14", end: "2026-10-20" };
      const c = { start: "2026-10-15", end: "2026-10-20" };
      expect(rangesOverlap(a, b)).toBe(true);
      expect(rangesOverlap(a, c)).toBe(false);
    });
    it("isInRange respects half-open interval", () => {
      const r = { start: "2026-10-10", end: "2026-10-15" };
      expect(isInRange("2026-10-10", r)).toBe(true);
      expect(isInRange("2026-10-14", r)).toBe(true);
      expect(isInRange("2026-10-15", r)).toBe(false);
    });
    it("eachDayInRange iterates half-open", () => {
      expect(eachDayInRange({ start: "2026-10-10", end: "2026-10-13" })).toEqual([
        "2026-10-10",
        "2026-10-11",
        "2026-10-12",
      ]);
      expect(eachDayInRange({ start: "2026-10-10", end: "2026-10-10" })).toEqual([]);
    });
  });

  describe("nightsInPeriod (docs/05 §2 golden case)", () => {
    it("check-in 30 Okt, check-out 3 Nov, period Oktober -> 30, 31 Okt", () => {
      const nights = nightsInPeriod("2026-10-30", "2026-11-03", "2026-10-01", "2026-11-01");
      expect(nights).toEqual(["2026-10-30", "2026-10-31"]);
    });
    it("booking entirely outside period -> empty", () => {
      expect(nightsInPeriod("2026-09-01", "2026-09-05", "2026-10-01", "2026-11-01")).toEqual([]);
    });
    it("booking entirely inside period -> all nights", () => {
      expect(nightsInPeriod("2026-10-10", "2026-10-13", "2026-10-01", "2026-11-01")).toEqual([
        "2026-10-10",
        "2026-10-11",
        "2026-10-12",
      ]);
    });
  });

  describe("month boundaries", () => {
    it("monthOf / startOfMonth / endOfMonth", () => {
      expect(monthOf("2026-10-19")).toBe("2026-10");
      expect(startOfMonth("2026-10-19")).toBe("2026-10-01");
      expect(endOfMonth("2026-10-19")).toBe("2026-10-31");
      expect(endOfMonth("2024-02-15")).toBe("2024-02-29");
      expect(endOfMonth("2026-02-15")).toBe("2026-02-28");
    });
  });

  describe("format id-ID", () => {
    it("formatStayDateId tanpa weekday", () => {
      const s = formatStayDateId("2026-10-19");
      expect(s).toMatch(/19 Okt 2026/);
    });
    it("formatStayDateId dengan weekday", () => {
      const s = formatStayDateId("2026-10-19", { withWeekday: true });
      // 2026-10-19 = Senin
      expect(s).toMatch(/Sen/);
      expect(s).toMatch(/19/);
    });
    it("formatMonthId -> nama bulan + tahun", () => {
      expect(formatMonthId("2026-10-19")).toBe("Oktober 2026");
    });
  });

  describe("parseStayDate (id-ID)", () => {
    it("ISO passthrough", () => {
      expect(parseStayDate("2026-10-19")).toBe("2026-10-19");
    });
    it("dd/mm/yyyy dan dd-mm-yyyy", () => {
      expect(parseStayDate("19/10/2026")).toBe("2026-10-19");
      expect(parseStayDate("19-10-2026")).toBe("2026-10-19");
    });
    it("nama bulan id-ID (lengkap & singkat)", () => {
      expect(parseStayDate("19 Oktober 2026")).toBe("2026-10-19");
      expect(parseStayDate("5 Jan 2026")).toBe("2026-01-05");
    });
    it("throws on unparseable", () => {
      expect(() => parseStayDate("bukan tanggal")).toThrow(/Unparseable/);
    });
  });
});
