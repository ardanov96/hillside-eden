/**
 * Tes untuk generator data dummy S1-06.
 *
 * Fokus: determinisme, invarian keuangan docs/04 §5, dan cakupan kasus tepi
 * yang diminta ROADMAP (modifikasi, pembatalan, estate, 2 kamar, mata uang beda).
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { daysBetween, isStayDate, type StayDate } from "../lib/dates";
import { Decimal } from "../lib/decimal";
import { detectScheduleCollisions } from "../domain/collision";
import {
  DUMMY_EXTERNAL_PREFIX,
  DEFAULT_DUMMY_SEED,
  countRoomNights,
  generateDummyDataset,
  mulberry32,
  seasonalFactor,
  usdIdrRate,
  type DummyGeneratorRefs,
} from "./dummy-data";

// ---------------------------------------------------------------------------
// Fixture: mencerminkan hasil prisma/seed.ts (2 properti, unit, listing).
// ---------------------------------------------------------------------------

const REFS: DummyGeneratorRefs = {
  units: [
    // Hillside Eden (estate) - 4 unit
    { unitId: "u-villa", propertyId: "p-he", name: "Villa", baseRate: "2500000", maxGuests: 6 },
    { unitId: "u-c1", propertyId: "p-he", name: "Cottage 1", baseRate: "900000", maxGuests: 2 },
    { unitId: "u-c2", propertyId: "p-he", name: "Cottage 2", baseRate: "900000", maxGuests: 2 },
    { unitId: "u-c3", propertyId: "p-he", name: "Cottage 3", baseRate: "900000", maxGuests: 2 },
    // Ubud Hillside (kamar) - hanya 2 kamar sellable
    { unitId: "u-uh1", propertyId: "p-uh", name: "Kamar 1", baseRate: "800000", maxGuests: 2 },
    { unitId: "u-uh2", propertyId: "p-uh", name: "Kamar 2", baseRate: "800000", maxGuests: 2 },
  ],
  listings: [
    {
      listingId: "l-he-airbnb",
      propertyId: "p-he",
      channel: "AIRBNB",
      currency: "IDR",
      unitIds: ["u-villa", "u-c1", "u-c2", "u-c3"],
      commissionRate: "0.1400",
    },
    {
      listingId: "l-he-tiket",
      propertyId: "p-he",
      channel: "TIKET_COM",
      currency: "IDR",
      unitIds: ["u-villa", "u-c1", "u-c2", "u-c3"],
      commissionRate: "0.1500",
    },
    {
      listingId: "l-he-traveloka",
      propertyId: "p-he",
      channel: "TRAVELOKA",
      currency: "IDR",
      unitIds: ["u-villa", "u-c1", "u-c2", "u-c3"],
      commissionRate: "0.1300",
    },
    {
      listingId: "l-uh-airbnb",
      propertyId: "p-uh",
      channel: "AIRBNB",
      currency: "IDR",
      // Hanya 2 dari 4 kamar yang disewakan (kasus tepi ROADMAP).
      unitIds: ["u-uh1", "u-uh2"],
      commissionRate: "0.1400",
    },
  ],
  categories: [
    { id: "c-salary", code: "SALARY" },
    { id: "c-utilities", code: "UTILITIES" },
    { id: "c-internet", code: "INTERNET" },
    { id: "c-housekeeping", code: "HOUSEKEEPING" },
    { id: "c-maintenance", code: "MAINTENANCE" },
    { id: "c-marketing", code: "MARKETING" },
    { id: "c-tax", code: "TAX_LICENSE_INSURANCE" },
    { id: "c-transport", code: "TRANSPORT" },
    { id: "c-rent", code: "RENT_LEASE" },
    { id: "c-misc", code: "MISC" },
  ],
  propertyIds: ["p-he", "p-uh"],
};

const ANCHOR: StayDate = "2026-10-20";
const build = (seed = DEFAULT_DUMMY_SEED): ReturnType<typeof generateDummyDataset> =>
  generateDummyDataset(REFS, { anchor: ANCHOR, seed });

// ---------------------------------------------------------------------------

describe("mulberry32", () => {
  it("menghasilkan urutan identik untuk seed yang sama", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(Array.from({ length: 100 }, () => a())).toEqual(Array.from({ length: 100 }, () => b()));
  });

  it("menghasilkan nilai pada rentang [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("menghasilkan urutan berbeda untuk seed berbeda", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("generateDummyDataset - determinisme", () => {
  it("seed + anchor sama menghasilkan output identik", () => {
    expect(build()).toEqual(build());
  });

  it("seed berbeda menghasilkan output berbeda", () => {
    expect(build(1).bookings).not.toEqual(build(2).bookings);
  });

  it("jangkar berbeda menggeser jendela data", () => {
    const shifted = generateDummyDataset(REFS, {
      anchor: "2026-11-20",
      seed: DEFAULT_DUMMY_SEED,
    });
    expect(build().anchor).toBe("2026-10-20");
    expect(shifted.anchor).toBe("2026-11-20");
    expect(shifted.windowStart).not.toBe(build().windowStart);
  });

  it("deterministik pada seed acak mana pun", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 }), (seed) => {
        expect(build(seed)).toEqual(build(seed));
      }),
      { numRuns: 10 },
    );
  });
});

describe("generateDummyDataset - invarian booking", () => {
  const data = build();

  it("menghasilkan booking dalam jumlah wajar untuk jendela 18 bulan", () => {
    expect(data.bookings.length).toBeGreaterThan(100);
  });

  it("semua externalId unik dan berprefiks penanda DUMMY", () => {
    const ids = data.bookings.map((b) => b.externalId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(DUMMY_EXTERNAL_PREFIX)).toBe(true);
  });

  it("checkOut selalu setelah checkIn dan nights konsisten", () => {
    for (const b of data.bookings) {
      expect(isStayDate(b.checkIn)).toBe(true);
      expect(isStayDate(b.checkOut)).toBe(true);
      expect(b.checkOut > b.checkIn).toBe(true);
      expect(b.nights).toBe(daysBetween(b.checkIn, b.checkOut));
    }
  });

  it("jumlah alokasi gross selalu sama dengan grossAmount (docs/04 §5)", () => {
    for (const b of data.bookings) {
      const sum = b.units.reduce(
        (acc, u) => acc.plus(new Decimal(u.allocatedGross)),
        new Decimal(0),
      );
      expect(sum.toFixed(2), `booking ${b.externalId}`).toBe(new Decimal(b.grossAmount).toFixed(2));
    }
  });

  it("jumlah persentase alokasi selalu 1.0000", () => {
    for (const b of data.bookings) {
      const sum = b.units.reduce(
        (acc, u) => acc.plus(new Decimal(u.allocationPct)),
        new Decimal(0),
      );
      expect(sum.toFixed(4), `booking ${b.externalId}`).toBe("1.0000");
    }
  });

  it("setiap booking punya minimal satu unit dan unitId unik", () => {
    for (const b of data.bookings) {
      expect(b.units.length).toBeGreaterThan(0);
      expect(new Set(b.units.map((u) => u.unitId)).size).toBe(b.units.length);
    }
  });

  it("unit yang dialokasikan selalu milik properti booking", () => {
    const propertyOf = new Map(REFS.units.map((u) => [u.unitId, u.propertyId]));
    for (const b of data.bookings) {
      for (const u of b.units) expect(propertyOf.get(u.unitId)).toBe(b.propertyId);
    }
  });

  it("kurs IDR = 1 dan kurs USD > 1", () => {
    for (const b of data.bookings) {
      const rate = new Decimal(b.fxRateToBase);
      if (b.currency === "IDR") expect(rate.equals(1)).toBe(true);
      else {
        expect(rate.greaterThan(1)).toBe(true);
        expect(b.fxRateSource).toContain("DUMMY");
      }
    }
  });

  it("komisi tidak negatif dan tidak melebihi gross", () => {
    for (const b of data.bookings) {
      const commission = new Decimal(b.commissionAmount);
      expect(commission.isNegative()).toBe(false);
      expect(commission.lessThanOrEqualTo(new Decimal(b.grossAmount))).toBe(true);
    }
  });

  it("taxesCollected selalu 0 (kebijakan pajak belum ditetapkan)", () => {
    for (const b of data.bookings) expect(new Decimal(b.taxesCollected).isZero()).toBe(true);
  });
});

describe("generateDummyDataset - kasus tepi ROADMAP", () => {
  const data = build();

  it("kasus tepi 1: memuat booking yang pernah dimodifikasi", () => {
    expect(data.events.filter((e) => e.type === "MODIFIED").length).toBeGreaterThan(0);
  });

  it("kasus tepi 2: memuat pembatalan dengan event CANCELLED", () => {
    const cancelled = data.bookings.filter((b) => b.status === "CANCELLED");
    expect(cancelled.length).toBeGreaterThan(0);
    const withEvent = new Set(
      data.events.filter((e) => e.type === "CANCELLED").map((e) => e.bookingExternalId),
    );
    for (const b of cancelled) expect(withEvent.has(b.externalId)).toBe(true);
  });

  it("kasus tepi 2b: pembatalan dapat memiliki cancellationFee", () => {
    expect(
      data.bookings.filter(
        (b) => b.status === "CANCELLED" && new Decimal(b.cancellationFee).greaterThan(0),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("kasus tepi 3: memuat no-show", () => {
    expect(data.bookings.filter((b) => b.status === "NO_SHOW").length).toBeGreaterThan(0);
  });

  it("kasus tepi 4: booking estate mencakup seluruh unit properti", () => {
    const estate = data.bookings.filter((b) => b.propertyId === "p-he");
    expect(estate.length).toBeGreaterThan(0);
    for (const b of estate) {
      expect(b.units.map((u) => u.unitId).sort()).toEqual(["u-c1", "u-c2", "u-c3", "u-villa"]);
    }
  });

  it("kasus tepi 5: booking Ubud hanya memakai 2 kamar sellable", () => {
    const rooms = data.bookings.filter((b) => b.propertyId === "p-uh");
    expect(rooms.length).toBeGreaterThan(0);
    for (const b of rooms) {
      expect(b.units.map((u) => u.unitId).sort()).toEqual(["u-uh1", "u-uh2"]);
    }
  });

  it("kasus tepi 5b: hanya kamar sellable yang dipakai", () => {
    for (const b of data.bookings.filter((x) => x.propertyId === "p-uh")) {
      expect(["u-uh1", "u-uh2"]).toContain(b.units[0]!.unitId);
    }
  });

  it("kasus tepi 6: memuat booking USD dengan kurs eksplisit", () => {
    expect(data.bookings.filter((b) => b.currency === "USD").length).toBeGreaterThan(0);
  });

  it("memuat ketiga OTA", () => {
    const channels = new Set(data.bookings.map((b) => b.channel));
    expect(channels).toContain("AIRBNB");
    expect(channels).toContain("TIKET_COM");
    expect(channels).toContain("TRAVELOKA");
  });

  it("memuat kedua jenis collect type", () => {
    const collects = new Set(data.bookings.map((b) => b.collectType));
    expect(collects).toContain("CHANNEL_COLLECT");
    expect(collects).toContain("HOTEL_COLLECT");
  });

  it("memuat booking lampau dan mendatang", () => {
    expect(data.bookings.some((b) => b.checkOut <= ANCHOR)).toBe(true);
    expect(data.bookings.some((b) => b.checkIn > ANCHOR)).toBe(true);
  });
});

describe("generateDummyDataset - jadwal bebas bentrok", () => {
  const data = build();

  it("tidak ada bentrok jadwal di seluruh unit", () => {
    const report = detectScheduleCollisions({
      bookings: data.bookings.map((b) => ({
        id: b.externalId,
        channel: b.channel,
        externalId: b.externalId,
        status: b.status,
        unitIds: b.units.map((u) => u.unitId),
        checkIn: b.checkIn,
        checkOut: b.checkOut,
      })),
    });
    expect(report.collisions.map((c) => c.message)).toEqual([]);
  });

  it("window mencakup 18 bulan ke belakang sampai 60 hari ke depan", () => {
    // Jangkar 2026-10-20 dikurangi 18 bulan -> April 2025 (awal bulan).
    expect(data.windowStart).toBe("2025-04-01");
    expect(data.windowEnd).toBe("2026-12-19");
  });

  it("menghitung malam terjual per properti per bulan", () => {
    const nights = countRoomNights(data.bookings);
    const keys = Object.keys(nights);
    expect(keys.length).toBeGreaterThan(12);
    expect(keys.every((k) => k.includes("|"))).toBe(true);
    for (const value of Object.values(nights)) expect(value).toBeGreaterThan(0);
  });
});

describe("generateDummyDataset - event & import", () => {
  const data = build();

  it("setiap booking punya tepat satu event CREATED", () => {
    const created = data.events.filter((e) => e.type === "CREATED");
    expect(created).toHaveLength(data.bookings.length);
    expect(new Set(created.map((e) => e.bookingExternalId)).size).toBe(data.bookings.length);
  });

  it("setiap event menunjuk booking yang ada", () => {
    const ids = new Set(data.bookings.map((b) => b.externalId));
    for (const e of data.events) expect(ids.has(e.bookingExternalId)).toBe(true);
  });

  it("import batch unik dan semua booking tertaut ke batch yang ada", () => {
    const keys = data.importBatches.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    const known = new Set(keys);
    for (const b of data.bookings) expect(known.has(b.importBatchKey)).toBe(true);
  });

  it("contentHash unik per batch (kunci ImportItem docs/04 §5)", () => {
    expect(data.importItems).toHaveLength(data.bookings.length);
    const seen = new Set(data.importItems.map((i) => `${i.batchKey}|${i.contentHash}`));
    expect(seen.size).toBe(data.importItems.length);
  });
});

describe("generateDummyDataset - payout", () => {
  const data = build();

  it("jumlah item payout sama dengan nilai payout", () => {
    expect(data.payouts.length).toBeGreaterThan(0);
    for (const p of data.payouts) {
      const sum = p.items.reduce((acc, it) => acc.plus(new Decimal(it.amount)), new Decimal(0));
      expect(sum.toFixed(2), p.reference).toBe(new Decimal(p.amount).toFixed(2));
    }
  });

  it("payout hanya berisi booking CHANNEL_COLLECT berstatus CONFIRMED", () => {
    const byId = new Map(data.bookings.map((b) => [b.externalId, b]));
    for (const p of data.payouts) {
      for (const it of p.items) {
        const b = byId.get(it.bookingExternalId)!;
        expect(b.collectType).toBe("CHANNEL_COLLECT");
        expect(b.status).toBe("CONFIRMED");
        expect(b.currency).toBe(p.currency);
      }
    }
  });

  it("reference payout unik dan berprefiks DUMMY", () => {
    const refs = data.payouts.map((p) => p.reference);
    expect(new Set(refs).size).toBe(refs.length);
    for (const r of refs) expect(r.startsWith(DUMMY_EXTERNAL_PREFIX)).toBe(true);
  });

  it("booking yang sudah dibayarkan memakai commissionBasis ACTUAL (aturan estimasi vs aktual)", () => {
    const settled = new Set(data.payouts.flatMap((p) => p.items.map((it) => it.bookingExternalId)));
    for (const b of data.bookings) {
      expect(b.commissionBasis).toBe(settled.has(b.externalId) ? "ACTUAL" : "ESTIMATED");
    }
    expect(data.bookings.some((b) => b.commissionBasis === "ACTUAL")).toBe(true);
    expect(data.bookings.some((b) => b.commissionBasis === "ESTIMATED")).toBe(true);
  });
});

describe("generateDummyDataset - pengeluaran", () => {
  const data = build();

  it("mencakup 10 kategori default", () => {
    expect(new Set(data.expenses.map((e) => e.categoryCode)).size).toBe(10);
  });

  it("jumlah alokasi biaya selalu sama dengan nilai expense (docs/04 §5)", () => {
    for (const e of data.expenses) {
      const sum = e.allocations.reduce(
        (acc, a) => acc.plus(new Decimal(a.amountBase)),
        new Decimal(0),
      );
      expect(sum.toFixed(2), e.key).toBe(new Decimal(e.amount).toFixed(2));
    }
  });

  it("hanya memakai properti yang dikenal", () => {
    for (const e of data.expenses) {
      if (e.propertyId) expect(REFS.propertyIds).toContain(e.propertyId);
      for (const a of e.allocations) expect(REFS.propertyIds).toContain(a.propertyId);
    }
  });

  it("status DRAFT hanya muncul pada bulan berjalan", () => {
    const currentMonth = ANCHOR.slice(0, 7);
    for (const e of data.expenses) {
      if (e.status === "DRAFT") expect(e.incurredOn.slice(0, 7)).toBe(currentMonth);
    }
    expect(data.expenses.some((e) => e.status === "VERIFIED")).toBe(true);
  });

  it("menyertakan satu entri pembalik yang persis membalik nilai aslinya", () => {
    const reversals = data.expenses.filter((e) => e.reversalOfKey !== undefined);
    expect(reversals).toHaveLength(1);
    const reversal = reversals[0]!;
    const original = data.expenses.find((e) => e.key === reversal.reversalOfKey);
    expect(original).toBeDefined();
    expect(new Decimal(reversal.amount).plus(new Decimal(original!.amount)).isZero()).toBe(true);
    expect(reversal.status).toBe("VERIFIED");
  });

  it("seluruhnya berlabel DUMMY pada vendor dan description", () => {
    for (const e of data.expenses) {
      expect(e.vendor).toContain("DUMMY");
      expect(e.description).toContain("DUMMY");
    }
  });

  it("tidak membuat OtherIncome (keputusan ROADMAP §4 masih terbuka)", () => {
    // Generator tidak punya plans OtherIncome sama sekali.
    expect("otherIncomes" in data).toBe(false);
  });
});

describe("musim & kurs", () => {
  it("faktor musim tinggi lebih besar dari musim rendah", () => {
    expect(seasonalFactor("2026-07-15")).toBeGreaterThan(seasonalFactor("2026-03-15"));
    expect(seasonalFactor("2026-12-15")).toBeGreaterThan(seasonalFactor("2026-11-15"));
  });

  it("kurs USD->IDR deterministik dan bergerak perlahan antar bulan", () => {
    const jan = usdIdrRate("2026-01-10");
    expect(usdIdrRate("2026-01-10").equals(jan)).toBe(true);
    const feb = usdIdrRate("2026-02-10");
    expect(feb.greaterThan(jan)).toBe(true);
    expect(feb.minus(jan).lessThan(100)).toBe(true);
  });
});
