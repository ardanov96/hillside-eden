/**
 * Unit test untuk booking-list-search-schema (S2-07.2 + S4-01).
 *
 * Sejak S4-01, filter `propertyId` dan `checkInFrom`/`checkInTo` pindah ke
 * filter global. Skema lokal hanya memvalidasi channel/status/search/sort/
 * pagination. Kunci global di URL diabaikan (bukan error) supaya URL
 * yang masih membawa kunci lama tidak membuat halaman rusak.
 */
import { describe, expect, it } from "vitest";

import {
  parseBookingListSearch,
  safeParseBookingListSearch,
} from "@/lib/forms/booking-list-search-schema";

describe("parseBookingListSearch", () => {
  it("mengembalikan default saat searchParams kosong", () => {
    const r = parseBookingListSearch({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(25);
    expect(r.sort).toBeUndefined();
    expect(r.channel).toBeUndefined();
    expect(r.status).toBeUndefined();
  });

  it("memfilter channel yang valid", () => {
    const r = parseBookingListSearch({ channel: "AIRBNB" });
    expect(r.channel).toBe("AIRBNB");
  });

  it("menolak channel yang tidak dikenal", () => {
    const r = safeParseBookingListSearch({ channel: "BOGUS" });
    expect(r.ok).toBe(false);
  });

  it("string kosong pada enum diperlakukan sebagai undefined", () => {
    const r = parseBookingListSearch({ channel: "", status: "" });
    expect(r.channel).toBeUndefined();
    expect(r.status).toBeUndefined();
  });

  it("mengabaikan (tidak memvalidasi) kunci global: propertyId & tanggal", () => {
    // Kunci global sekarang ditangani oleh src/lib/filters/global-filter.ts;
    // schema lokal harus menerimanya tanpa error agar URL lama tidak crash.
    const r = parseBookingListSearch({
      propertyId: "prop_abc",
      checkInFrom: "2026-10-01",
      checkInTo: "2026-10-31",
      period: "this_month",
    });
    expect(r.channel).toBeUndefined();
    expect(r.status).toBeUndefined();
    // Kunci global TIDAK bocor ke objek hasil (Zod strip by default).
    expect((r as Record<string, unknown>).propertyId).toBeUndefined();
    expect((r as Record<string, unknown>).checkInFrom).toBeUndefined();
  });

  it("memangkas spasi pada pencarian", () => {
    const r = parseBookingListSearch({ search: "  HMABC  " });
    expect(r.search).toBe("HMABC");
  });

  it("mengabaikan pencarian kosong", () => {
    const r = parseBookingListSearch({ search: "   " });
    expect(r.search).toBeUndefined();
  });

  it("memvalidasi sort key asc/desc", () => {
    const r = parseBookingListSearch({ sort: "grossAmount:asc" });
    expect(r.sort).toEqual({ key: "grossAmount", dir: "asc" });
  });

  it("default sort desc bila tidak ada direction", () => {
    const r = parseBookingListSearch({ sort: "checkIn" });
    expect(r.sort).toEqual({ key: "checkIn", dir: "desc" });
  });

  it("menolak sort key yang tidak dikenal", () => {
    const r = safeParseBookingListSearch({ sort: "bogus:asc" });
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.sort).toBeUndefined();
  });

  it("memvalidasi page >= 1 dan pageSize <= MAX_PAGE_SIZE", () => {
    expect(() => parseBookingListSearch({ page: "0" })).toThrow();
    expect(() => parseBookingListSearch({ pageSize: "999" })).toThrow();
  });

  it("mendukung array -> ambil elemen pertama (Next style)", () => {
    const r = parseBookingListSearch({ channel: ["AIRBNB", "TIKET_COM"] });
    expect(r.channel).toBe("AIRBNB");
  });
});
