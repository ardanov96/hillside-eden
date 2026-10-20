/**
 * Unit test untuk buildBookingWhere (S2-07.1).
 * Hanya menguji	where builder; query DB di integration test.
 */
import { describe, expect, it } from "vitest";
import { buildBookingWhere } from "@/server/queries/bookings";

const ORG = "org-1";

describe("buildBookingWhere", () => {
  it("selalu membatasi organizationId", () => {
    expect(buildBookingWhere(ORG)).toEqual({ organizationId: ORG });
  });

  it("memakai filter channel", () => {
    expect(buildBookingWhere(ORG, { channel: "AIRBNB" })).toEqual({
      organizationId: ORG,
      channel: "AIRBNB",
    });
  });

  it("memakai filter propertyId & status", () => {
    const w = buildBookingWhere(ORG, { propertyId: "P1", status: "CONFIRMED" });
    expect(w).toMatchObject({ organizationId: ORG, propertyId: "P1", status: "CONFIRMED" });
  });

  it("mengabaikan filter null/undefined", () => {
    const w = buildBookingWhere(ORG, {
      channel: null,
      propertyId: null,
      status: null,
      checkInFrom: null,
      checkInTo: null,
      search: null,
    });
    expect(w).toEqual({ organizationId: ORG });
  });

  it("membuat rentang checkIn dari checkInFrom saja", () => {
    const w = buildBookingWhere(ORG, { checkInFrom: "2026-10-01" });
    expect(w.checkIn).toEqual({ gte: new Date("2026-10-01T00:00:00Z") });
  });

  it("membuat rentang checkIn dari checkInTo saja (inklusif akhir hari)", () => {
    const w = buildBookingWhere(ORG, { checkInTo: "2026-10-31" });
    expect(w.checkIn).toEqual({ lte: new Date("2026-10-31T23:59:59.999Z") });
  });

  it("membuat rentang checkIn lengkap", () => {
    const w = buildBookingWhere(ORG, { checkInFrom: "2026-10-01", checkInTo: "2026-10-31" });
    expect(w.checkIn).toEqual({
      gte: new Date("2026-10-01T00:00:00Z"),
      lte: new Date("2026-10-31T23:59:59.999Z"),
    });
  });

  it("mencari externalId secara case-insensitive", () => {
    const w = buildBookingWhere(ORG, { search: "HMABC" });
    expect(w.externalId).toEqual({ contains: "HMABC", mode: "insensitive" });
  });

  it("memangkas spasi pada pencarian", () => {
    const w = buildBookingWhere(ORG, { search: "  HMABC  " });
    expect(w.externalId).toEqual({ contains: "HMABC", mode: "insensitive" });
  });

  it("mengabaikan pencarian kosong/spasi", () => {
    expect(buildBookingWhere(ORG, { search: "   " })).toEqual({ organizationId: ORG });
    expect(buildBookingWhere(ORG, { search: "" })).toEqual({ organizationId: ORG });
  });

  it("menggabungkan beberapa filter sekaligus", () => {
    const w = buildBookingWhere(ORG, {
      channel: "TIKET_COM",
      propertyId: "P2",
      status: "CANCELLED",
      checkInFrom: "2026-10-01",
      checkInTo: "2026-10-31",
      search: "TKT1",
    });
    expect(w).toEqual({
      organizationId: ORG,
      channel: "TIKET_COM",
      propertyId: "P2",
      status: "CANCELLED",
      checkIn: {
        gte: new Date("2026-10-01T00:00:00Z"),
        lte: new Date("2026-10-31T23:59:59.999Z"),
      },
      externalId: { contains: "TKT1", mode: "insensitive" },
    });
  });

  it("tidak mengizinkan filter lintas organisasi", () => {
    // organizationId selalu dari argumen, tidak pernah bisa di-override filter.
    const w = buildBookingWhere("org-2", { propertyId: "P-from-org-1" });
    expect(w.organizationId).toBe("org-2");
  });
});
