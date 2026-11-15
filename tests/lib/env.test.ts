/**
 * Unit test validasi environment (src/lib/env.ts).
 *
 * Fokus: produksi WAJIB punya AUTH_SECRET + ENCRYPTION_KEY + trustHost
 * (AUTH_URL atau AUTH_TRUST_HOST); development boleh memakai placeholder;
 * build (`phase-production-build`) tidak punya secret runtime sehingga
 * pengecekan produksi ditunda.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv } from "@/lib/env";

const PROD_SECRET = "a".repeat(32);
const PROD_KEY = "b".repeat(32);

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
    expect(() => validateEnv({ NODE_ENV: "production", AUTH_SECRET: PROD_SECRET })).toThrow();
  });

  it("menerima produksi dengan AUTH_SECRET dan ENCRYPTION_KEY yang valid", () => {
    const env = validateEnv({
      NODE_ENV: "production",
      AUTH_SECRET: PROD_SECRET,
      ENCRYPTION_KEY: PROD_KEY,
      AUTH_URL: "https://hillside-eden.example.com",
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.ENCRYPTION_KEY).toBe(PROD_KEY);
  });

  it("menolak ENCRYPTION_KEY yang terlalu pendek di produksi", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: "pendek",
        AUTH_URL: "https://hillside-eden.example.com",
      }),
    ).toThrow();
  });

  it("menolak produksi tanpa AUTH_URL maupun AUTH_TRUST_HOST (risiko UntrustedHost)", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: PROD_KEY,
      }),
    ).toThrow();
  });

  it("menerima produksi dengan AUTH_TRUST_HOST=true", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: PROD_KEY,
        AUTH_TRUST_HOST: "true",
      }),
    ).not.toThrow();
  });

  it("menolak produksi dengan AUTH_TRUST_HOST=false", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: PROD_KEY,
        AUTH_TRUST_HOST: "false",
      }),
    ).toThrow();
  });

  it("menolak AUTH_URL yang bukan URL", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: PROD_KEY,
        AUTH_URL: "bukan-url",
      }),
    ).toThrow();
  });

  it("menganggap AUTH_URL kosong sebagai tidak diset", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: PROD_SECRET,
        ENCRYPTION_KEY: PROD_KEY,
        AUTH_URL: "   ",
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
