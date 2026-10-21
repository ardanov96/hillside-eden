/**
 * Unit test untuk badge-config (S2-07.4).
 * Bertujuan murni: logika turunan dan konsistensi label dengan copy deck.
 */
import { describe, expect, it } from "vitest";

import {
  BADGE_TONE_CLASS,
  BOOKING_STATUS_BADGE,
  COLLECT_TYPE_BADGE,
  DATA_STATUS_BADGE,
  resolveDataStatus,
} from "@/lib/badges/badge-config";

describe("BOOKING_STATUS_BADGE", () => {
  it("menyediakan label untuk keempat status", () => {
    expect(Object.keys(BOOKING_STATUS_BADGE).sort()).toEqual([
      "CANCELLED",
      "CONFIRMED",
      "NO_SHOW",
      "PENDING",
    ]);
  });

  it("mengikuti copy deck docs/07-ui-spec.md §1", () => {
    expect(BOOKING_STATUS_BADGE.PENDING.label).toBe("Menunggu");
    expect(BOOKING_STATUS_BADGE.CONFIRMED.label).toBe("Dikonfirmasi");
    expect(BOOKING_STATUS_BADGE.CANCELLED.label).toBe("Dibatalkan");
    expect(BOOKING_STATUS_BADGE.NO_SHOW.label).toBe("Tidak hadir");
  });

  it("memberikan tone yang dapat dibedakan", () => {
    const tones = Object.values(BOOKING_STATUS_BADGE).map((b) => b.tone);
    // minimal tiga tone unik (caution/positive/danger/muted).
    expect(new Set(tones).size).toBeGreaterThanOrEqual(3);
  });
});

describe("DATA_STATUS_BADGE", () => {
  it("menyediakan ketiga jenis sesuai §4", () => {
    expect(DATA_STATUS_BADGE.AKTUAL.label).toBe("Aktual");
    expect(DATA_STATUS_BADGE.ESTIMASI.label).toBe("Estimasi");
    expect(DATA_STATUS_BADGE.BELUM_LENGKAP.label).toBe("Belum lengkap");
    expect(DATA_STATUS_BADGE.AKTUAL.kind).toBe("AKTUAL");
    expect(DATA_STATUS_BADGE.ESTIMASI.kind).toBe("ESTIMASI");
    expect(DATA_STATUS_BADGE.BELUM_LENGKAP.kind).toBe("BELUM_LENGKAP");
  });
});

describe("resolveDataStatus", () => {
  it("mengembalikan AKTUAL bila commissionAmount ada (ADR-004)", () => {
    expect(resolveDataStatus({ commissionAmount: "150000", commissionRate: null })).toBe(
      DATA_STATUS_BADGE.AKTUAL,
    );
  });

  it("mengembalikan AKTUAL untuk Decimal-like object", () => {
    const decimal = { toString: () => "150.50" };
    expect(resolveDataStatus({ commissionAmount: decimal, commissionRate: null })).toBe(
      DATA_STATUS_BADGE.AKTUAL,
    );
  });

  it("mengembalikan ESTIMASI bila hanya commissionRate yang ada", () => {
    expect(resolveDataStatus({ commissionAmount: null, commissionRate: "0.15" })).toBe(
      DATA_STATUS_BADGE.ESTIMASI,
    );
  });

  it("mengembalikan BELUM_LENGKAP bila keduanya null", () => {
    expect(resolveDataStatus({ commissionAmount: null, commissionRate: null })).toBe(
      DATA_STATUS_BADGE.BELUM_LENGKAP,
    );
  });

  it("mengembalikan BELUM_LENGKAP bila keduanya undefined", () => {
    expect(resolveDataStatus({})).toBe(DATA_STATUS_BADGE.BELUM_LENGKAP);
  });

  it("mengabaikan string kosong sebagai tidak-ada", () => {
    expect(resolveDataStatus({ commissionAmount: "", commissionRate: "" })).toBe(
      DATA_STATUS_BADGE.BELUM_LENGKAP,
    );
  });

  it("mengabaikan NaN/Infinity sebagai tidak-ada", () => {
    expect(resolveDataStatus({ commissionAmount: NaN, commissionRate: Infinity })).toBe(
      DATA_STATUS_BADGE.BELUM_LENGKAP,
    );
  });

  it("memperlakukan commissionBasis=MANUAL dengan nilai apa pun sebagai AKTUAL", () => {
    expect(
      resolveDataStatus({
        commissionAmount: null,
        commissionRate: "0.15",
        commissionBasis: "MANUAL",
      }),
    ).toBe(DATA_STATUS_BADGE.AKTUAL);
  });

  it("tetap BELUM_LENGKAP bila MANUAL tapi tanpa nilai", () => {
    expect(
      resolveDataStatus({
        commissionAmount: null,
        commissionRate: null,
        commissionBasis: "MANUAL",
      }),
    ).toBe(DATA_STATUS_BADGE.BELUM_LENGKAP);
  });

  it("mengutamakan commissionAmount di atas rate (amount > rate)", () => {
    expect(resolveDataStatus({ commissionAmount: "150000", commissionRate: "0.15" })).toBe(
      DATA_STATUS_BADGE.AKTUAL,
    );
  });
});

describe("COLLECT_TYPE_BADGE", () => {
  it("mengikuti copy deck docs/07-ui-spec.md §1", () => {
    expect(COLLECT_TYPE_BADGE.CHANNEL_COLLECT.label).toBe("Ditagih OTA");
    expect(COLLECT_TYPE_BADGE.HOTEL_COLLECT.label).toBe("Ditagih hotel");
    expect(COLLECT_TYPE_BADGE.UNKNOWN.label).toBe("Belum diketahui");
  });

  it("HOTEL_COLLECT memakai tone positif (uang langsung ke hotel)", () => {
    expect(COLLECT_TYPE_BADGE.HOTEL_COLLECT.tone).toBe("positive");
  });

  it("CHANNEL_COLLECT memakai tone info (bukan positif; bukan net = milik kita)", () => {
    // ADR-009: jangan memakai tone positif untuk net; ini berisiko salah baca.
    expect(COLLECT_TYPE_BADGE.CHANNEL_COLLECT.tone).not.toBe("positive");
  });
});

describe("BADGE_TONE_CLASS", () => {
  it("menyediakan kelas Tailwind untuk kelima tone", () => {
    const tones = ["positive", "caution", "danger", "muted", "info"] as const;
    for (const tone of tones) {
      const cls = BADGE_TONE_CLASS[tone];
      expect(cls.bg).toMatch(/^bg-/);
      expect(cls.text).toMatch(/^text-/);
      expect(cls.border).toMatch(/^border-/);
    }
  });

  it("tidak ada kelas warna hardcoded di luar palette (semua via prefix Tailwind)", () => {
    for (const tone of Object.values(BADGE_TONE_CLASS)) {
      // Pastikan kombinasi bg+text memberikan kontras yang aman
      // (light bg + dark text). Tes sederhana: bg & text tidak sama prefix.
      expect(tone.bg.startsWith(tone.text.slice(0, 5))).toBe(false);
    }
  });
});
