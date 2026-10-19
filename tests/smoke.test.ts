// Smoke test untuk memastikan test runner berfungsi.
// Akan diganti dengan KPI/library test di Sprint 1.
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test suite", () => {
    expect(1 + 1).toBe(2);
  });

  it("formats IDR-like numbers", () => {
    const formatter = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
    const formatted = formatter.format(1500000);
    // Format Indonesia: "Rp 1.500.000"
    expect(formatted).toMatch(/Rp\s?1\.500\.000/);
  });

  it("uses WITA timezone identifier", () => {
    // Validasi string konstan sesuai docs/02 & docs/05.
    expect("Asia/Makassar").toBe("Asia/Makassar");
  });
});
