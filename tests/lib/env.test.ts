/**
 * Unit test validasi environment (src/lib/env.ts).
 *
 * Fokus: produksi WAJIB punya AUTH_SECRET + ENCRYPTION_KEY; development boleh
 * memakai placeholder; build (`phase-production-build`) tidak punya secret
 * runtime sehingga pengecekan produksi ditunda.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv } from "@/lib/env";

describe("validasi environment (src/lib/env.ts)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("menolak produksi tanpa AUTH_SECRET dan ENCRYPTION_KEY", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow();
  });

  it("menolak produksi tanpa ENCRYPTION_KEY meski AUTH_SECRET ada", () => {
    expect(() => validateEnv({ NODE_ENV: "production", AUTH_SECRET: "a".repeat(32) })).toThrow();
  });

  it("menerima produksi dengan AUTH_SECRET dan ENCRYPTION_KEY yang valid", () => {
    const env = validateEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "a".repeat(32),
      ENCRYPTION_KEY: "b".repeat(32),
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.ENCRYPTION_KEY).toBe("b".repeat(32));
  });

  it("menolak ENCRYPTION_KEY yang terlalu pendek di produksi", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "a".repeat(32),
        ENCRYPTION_KEY: "pendek",
      }),
    ).toThrow();
  });

  it("menunda pengecekan produksi saat build (phase-production-build)", () => {
    expect(() =>
      validateEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
  });

  it("menerima development tanpa secret apa pun", () => {
    const env = validateEnv({ NODE_ENV: "development" });
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
  });

  it("menolak APP_BASE_URL yang bukan URL", () => {
    expect(() => validateEnv({ NODE_ENV: "development", APP_BASE_URL: "bukan-url" })).toThrow();
  });

  it("menolak DATABASE_URL yang bukan URL", () => {
    expect(() => validateEnv({ NODE_ENV: "development", DATABASE_URL: "bukan-url" })).toThrow();
  });
});
