/**
 * Regresi: halaman detail booking `/bookings/[id]` harus benar-benar ada.
 *
 * Tabel booking menautkan baris ke route ini. Sebelum route-nya dibuat, klik
 * booking berakhir di 404. Tes ini menjaga tautan dan route tetap sepadan.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const BOOKINGS_DIR = path.join(REPO_ROOT, "src", "app", "(app)", "bookings");

describe("route detail booking", () => {
  it("halaman /bookings/[id] tersedia", () => {
    expect(existsSync(path.join(BOOKINGS_DIR, "[id]", "page.tsx"))).toBe(true);
  });

  it("halaman detail punya loading dan not-found", () => {
    expect(existsSync(path.join(BOOKINGS_DIR, "[id]", "loading.tsx"))).toBe(true);
    expect(existsSync(path.join(BOOKINGS_DIR, "[id]", "not-found.tsx"))).toBe(true);
  });

  it("tautan dari tabel booking menuju route yang tersedia", () => {
    const table = readFileSync(path.join(BOOKINGS_DIR, "booking-table.tsx"), "utf-8");
    expect(table).toContain("/bookings/${r.id}");
    expect(existsSync(path.join(BOOKINGS_DIR, "[id]", "page.tsx"))).toBe(true);
  });
});
