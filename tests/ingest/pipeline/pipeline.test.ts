/**
 * Unit test untuk pipeline.ts (S2-02.7).
 * Fokus pada computeContentHash (murni & deterministik). Orkestrasi penuh
 * diuji lewat integration test dengan DB (tests/integration/).
 */
import { describe, expect, it } from "vitest";
import { computeContentHash } from "@/ingest/pipeline/pipeline";

describe("computeContentHash", () => {
  it("menghasilkan hash hex 64 karakter (SHA-256)", () => {
    const hash = computeContentHash("airbnb.email.v1", { a: 1 });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deterministik untuk input yang sama", () => {
    const a = computeContentHash("adapter.v1", { x: 1, y: 2 });
    const b = computeContentHash("adapter.v1", { x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it("mengabaikan urutan key pada object", () => {
    const a = computeContentHash("adapter.v1", { x: 1, y: 2, z: 3 });
    const b = computeContentHash("adapter.v1", { z: 3, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it("mempertahankan urutan array (order-significant)", () => {
    const a = computeContentHash("adapter.v1", { items: [1, 2, 3] });
    const b = computeContentHash("adapter.v1", { items: [3, 2, 1] });
    expect(a).not.toBe(b);
  });

  it("berbeda bila adapterId berbeda walau payload sama", () => {
    const payload = { x: 1 };
    expect(computeContentHash("a.v1", payload)).not.toBe(computeContentHash("b.v1", payload));
  });

  it("berbeda bila nilai payload berbeda", () => {
    expect(computeContentHash("a.v1", { x: 1 })).not.toBe(computeContentHash("a.v1", { x: 2 }));
  });

  it("mengabaikan key dengan nilai undefined", () => {
    const a = computeContentHash("a.v1", { x: 1, y: undefined });
    const b = computeContentHash("a.v1", { x: 1 });
    expect(a).toBe(b);
  });

  it("menangani nested object dan null", () => {
    const hash = computeContentHash("a.v1", {
      nested: { deep: { value: null } },
      list: [{ a: 1 }, { b: 2 }],
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tidak throwing pada payload primitif", () => {
    expect(computeContentHash("a.v1", "teks")).toMatch(/^[0-9a-f]{64}$/);
    expect(computeContentHash("a.v1", 42)).toMatch(/^[0-9a-f]{64}$/);
    expect(computeContentHash("a.v1", null)).toMatch(/^[0-9a-f]{64}$/);
  });
});
