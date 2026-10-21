/**
 * Unit test untuk src/lib/filters/global-filter.ts (S4-01).
 *
 * Semua fungsi menerima `today` secara eksplisit agar deterministik:
 * tidak ada ketergantungan pada jam dinding (AGENTS.md aturan 3).
 */
import { describe, expect, it } from "vitest";

import {
  GLOBAL_FILTER_KEYS,
  PERIOD_PRESETS,
  globalFilterQueryString,
  mergeKeepingNonGlobal,
  parseGlobalFilter,
  parseGlobalFilterSelection,
  resolvePeriodRange,
  serializeParams,
} from "@/lib/filters/global-filter";
import type { StayDate } from "@/lib/dates";

const TODAY = "2026-10-21" as StayDate;

describe("parseGlobalFilter", () => {
  it("default this_month bila searchParams kosong", () => {
    const f = parseGlobalFilter({}, TODAY);
    expect(f.period).toBe("this_month");
    expect(f.range).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(f.propertyId).toBeUndefined();
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
  });

  it("mengambil propertyId", () => {
    expect(parseGlobalFilter({ propertyId: "prop_abc" }, TODAY).propertyId).toBe("prop_abc");
  });

  it("period tidak dikenal jatuh ke this_month", () => {
    expect(parseGlobalFilter({ period: "minggu_ini" }, TODAY).period).toBe("this_month");
  });

  it("menolak tanggal tidak valid; custom tanpa range -> null", () => {
    const f = parseGlobalFilter(
      { period: "custom", from: "10/01/2026", to: "bukan-tanggal" },
      TODAY,
    );
    expect(f.period).toBe("custom");
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
    expect(f.range).toBeNull();
  });

  it("mendukung array (Next style): elemen pertama", () => {
    expect(parseGlobalFilter({ propertyId: ["prop_a", "prop_b"] }, TODAY).propertyId).toBe(
      "prop_a",
    );
  });

  it("string kosong dianggap tidak ada", () => {
    const f = parseGlobalFilter({ propertyId: "", period: "", from: "", to: "" }, TODAY);
    expect(f.propertyId).toBeUndefined();
    expect(f.period).toBe("this_month");
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
  });

  it("deterministik: dua parse input sama menghasilkan output sama", () => {
    const raw = { period: "last_month", propertyId: "p1" };
    expect(parseGlobalFilter(raw, TODAY)).toEqual(parseGlobalFilter(raw, TODAY));
  });
});

describe("parseGlobalFilterSelection", () => {
  it("tidak membutuhkan jam dinding: tanpa `range`", () => {
    const sel = parseGlobalFilterSelection({ period: "last_month", propertyId: "p1" });
    expect(sel).toEqual({ period: "last_month", propertyId: "p1" });
    expect("range" in sel).toBe(false);
  });

  it("memakai default yang sama dengan parseGlobalFilter", () => {
    expect(parseGlobalFilterSelection({})).toEqual({ period: "this_month" });
  });

  it("mengabaikan from/to yang tidak valid", () => {
    expect(parseGlobalFilterSelection({ period: "custom", from: "01-10-2026", to: "" })).toEqual({
      period: "custom",
    });
  });

  it("parseGlobalFilter = selection + range", () => {
    const raw = { period: "last_month" as const, propertyId: "p1" };
    expect(parseGlobalFilter(raw, TODAY)).toEqual({
      ...parseGlobalFilterSelection(raw),
      range: { start: "2026-09-01", end: "2026-09-30" },
    });
  });
});

describe("resolvePeriodRange", () => {
  it("this_month di awal bulan", () => {
    expect(resolvePeriodRange("this_month", "2026-10-01" as StayDate)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
  });

  it("this_month di tengah bulan", () => {
    expect(resolvePeriodRange("this_month", TODAY)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
  });

  it("this_month Februari tahun kabisat", () => {
    expect(resolvePeriodRange("this_month", "2028-02-15" as StayDate)).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("last_month dari Januari -> Desember tahun sebelumnya", () => {
    expect(resolvePeriodRange("last_month", "2026-01-15" as StayDate)).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("last_month dari Maret -> Februari", () => {
    expect(resolvePeriodRange("last_month", "2026-03-10" as StayDate)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("this_year = 1 Jan sampai 31 Des tahun berjalan", () => {
    expect(resolvePeriodRange("this_year", "2026-07-15" as StayDate)).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("custom dengan from/to valid", () => {
    expect(
      resolvePeriodRange("custom", TODAY, "2026-10-01" as StayDate, "2026-10-31" as StayDate),
    ).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("custom dengan from > to ditukar agar tetap valid", () => {
    expect(
      resolvePeriodRange("custom", TODAY, "2026-10-31" as StayDate, "2026-10-01" as StayDate),
    ).toEqual({ start: "2026-10-01", end: "2026-10-31" });
  });

  it("custom tanpa from/to menghasilkan null", () => {
    expect(resolvePeriodRange("custom", TODAY)).toBeNull();
  });

  it("custom hanya dengan from menghasilkan null", () => {
    expect(resolvePeriodRange("custom", TODAY, "2026-10-01" as StayDate)).toBeNull();
  });
});

describe("globalFilterQueryString", () => {
  it("hanya menyertakan propertyId dan period", () => {
    expect(
      globalFilterQueryString({
        propertyId: "prop_abc",
        period: "last_month",
      }),
    ).toBe("?propertyId=prop_abc&period=last_month");
  });

  it("from/to hanya ikut saat period=custom", () => {
    expect(
      globalFilterQueryString({
        period: "custom",
        from: "2026-10-01" as StayDate,
        to: "2026-10-31" as StayDate,
      }),
    ).toBe("?period=custom&from=2026-10-01&to=2026-10-31");
  });

  it("from/to tidak ikut saat period non-custom walau ada di objek", () => {
    const qs = globalFilterQueryString({
      period: "this_month",
      from: "2026-10-01" as StayDate,
      to: "2026-10-31" as StayDate,
    });
    expect(qs).toBe("?period=this_month");
  });

  it("selalu menyertakan period (default), meski tanpa propertyId", () => {
    expect(globalFilterQueryString({ period: "this_month" })).toBe("?period=this_month");
  });
});

describe("mergeKeepingNonGlobal", () => {
  it("mempertahankan parameter lokal dan menimpa parameter global", () => {
    const merged = mergeKeepingNonGlobal(
      {
        channel: "AIRBNB",
        status: "CONFIRMED",
        page: "3",
        sort: "checkIn:asc",
        propertyId: "lama",
        period: "this_month",
      },
      { propertyId: "baru", period: "last_month" },
    );
    expect(merged).toEqual({
      channel: "AIRBNB",
      status: "CONFIRMED",
      page: "3",
      sort: "checkIn:asc",
      propertyId: "baru",
      period: "last_month",
    });
  });

  it("menghapus from/to saat period bukan custom", () => {
    const merged = mergeKeepingNonGlobal(
      { from: "2026-10-01", to: "2026-10-31", page: "1" },
      { period: "this_month" },
    );
    expect(merged.from).toBeUndefined();
    expect(merged.to).toBeUndefined();
    expect(merged.page).toBe("1");
  });

  it("memperbarui from/to saat period custom", () => {
    const merged = mergeKeepingNonGlobal(
      { period: "custom", from: "2026-10-01", to: "2026-10-31" },
      { period: "custom", from: "2026-09-01", to: "2026-09-30" },
    );
    expect(merged).toEqual({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("string kosong menghapus kunci (dropdown Semua properti)", () => {
    const merged = mergeKeepingNonGlobal({ propertyId: "lama", page: "2" }, { propertyId: "" });
    expect(merged).toEqual({ page: "2" });
  });

  it("membuang nilai kosong yang sudah ada di URL saat ini", () => {
    const merged = mergeKeepingNonGlobal({ channel: "", status: "AIRBNB" }, {});
    expect(merged).toEqual({ status: "AIRBNB" });
  });

  it("mengambil elemen pertama dari array", () => {
    const merged = mergeKeepingNonGlobal({ channel: ["AIRBNB", "TIKET_COM"] }, {});
    expect(merged.channel).toBe("AIRBNB");
  });
});

describe("serializeParams", () => {
  it("mengawali dengan ? dan meng-encode nilai", () => {
    expect(serializeParams({ search: "AB 12" })).toBe("?search=AB+12");
  });

  it("mengabaikan entri kosong", () => {
    expect(serializeParams({ a: "1", b: "" })).toBe("?a=1");
  });

  it("mengembalikan string kosong untuk objek kosong", () => {
    expect(serializeParams({})).toBe("");
  });

  it("meng-escape karakter khusus pada kunci dan nilai", () => {
    expect(serializeParams({ "a&b": "c=d" })).toBe("?a%26b=c%3Dd");
  });
});

describe("konstanta", () => {
  it("GLOBAL_FILTER_KEYS berisi keempat kunci", () => {
    expect([...GLOBAL_FILTER_KEYS].sort()).toEqual(["from", "period", "propertyId", "to"]);
  });

  it("PERIOD_PRESETS berisi 4 preset tanpa duplikat", () => {
    expect(new Set(PERIOD_PRESETS).size).toBe(4);
  });
});
